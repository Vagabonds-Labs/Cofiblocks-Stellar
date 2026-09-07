/**
 * Prueba la capa de cadena del backend contra testnet: arma, firma, envía y
 * verifica los eventos, igual que hacen las rutas de checkout.
 */
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

import { ContractFactory, EventsClient } from '../src/lib/StellarContracts';
import { stroopsToUsd, usdToStroops } from '../src/lib/StellarContracts/utils';
import * as Products from '../src/services/onchain/OnChainProductsService';
import * as Balances from '../src/services/onchain/OnChainBalancesService';
import * as Env from '../src/services/onchain/OnChainEnvService';
import { PaymentToken } from '../src/lib/StellarContracts/types/transactions';

const factory = new ContractFactory();
const events = new EventsClient();

const PRODUCER_SECRET = process.env.PRODUCER_SECRET!;
const BUYER_SECRET = process.env.BUYER_SECRET!;

/** Simula lo que hace la wallet del usuario: firmar el XDR que armó el backend. */
function signAsWallet(xdr: string, secret: string, passphrase: string): string {
  const tx = TransactionBuilder.fromXDR(xdr, passphrase);
  tx.sign(Keypair.fromSecret(secret));
  return tx.toXDR();
}

async function main() {
  const producer = Keypair.fromSecret(PRODUCER_SECRET).publicKey();
  const buyer = Keypair.fromSecret(BUYER_SECRET).publicKey();
  const submitter = factory.getTxSubmitter();
  const passphrase = Env.getNetworkPassphrase();

  console.log('red        ', Env.getNetwork());
  console.log('marketplace', Env.getMarketplaceAddress());
  console.log('');

  // ── balances y trustline ────────────────────────────────────────────────
  const balances = await Balances.getWalletBalances(buyer);
  const hasTrustline = await Balances.hasUSDCTrustline(buyer);
  console.log('① balances del comprador:', balances, '| trustline USDC:', hasTrustline);
  if (!hasTrustline) throw new Error('el comprador no tiene trustline a USDC');

  // ── publicar ────────────────────────────────────────────────────────────
  const PRICE_USD = 10;
  const STOCK = 20;
  const prepared = await Products.createProductTx(producer, STOCK, PRICE_USD, null, 'probe-product');
  console.log('② create_product preparado | válido hasta', new Date(prepared.valid_until * 1000).toISOString());
  if (prepared.network_passphrase !== passphrase) throw new Error('passphrase incorrecta');

  const signed = signAsWallet(prepared.xdr, PRODUCER_SECRET, passphrase);
  const { hash: deployHash } = await submitter.submitSigned(signed);
  console.log('   enviado con fee-bump del backend, hash', deployHash);

  const created = await Products.verifyCreateProductTx(producer, deployHash);
  console.log('   verificado:', created);
  if (created.initialStock !== STOCK) throw new Error('initialStock no coincide');
  // El evento trae el precio con fee de mercado: 10 USD → 15 USD.
  if (created.price !== PRICE_USD * 1.5) throw new Error(`precio inesperado: ${created.price}`);

  const onChain = await Products.getProduct(created.tokenId);
  console.log('   get_product:', onChain);
  if (Number(onChain.stock) !== STOCK) throw new Error('stock on-chain no coincide');

  // ── ajustar stock ───────────────────────────────────────────────────────
  const addStockTx = await Products.addProductStock(producer, created.tokenId, 5);
  await submitter.submitSigned(signAsWallet(addStockTx.xdr, PRODUCER_SECRET, passphrase));
  const afterAdd = await Products.getProductStock(created.tokenId);
  console.log('③ add_stock: stock', STOCK, '→', afterAdd);
  if (afterAdd !== STOCK + 5) throw new Error('add_stock no sumó');

  // ── comprar ─────────────────────────────────────────────────────────────
  const AMOUNT = 3;
  const DELIVERY_USD = 2;
  const ORDER_TOTAL_USD = PRICE_USD * 1.5 * AMOUNT; // lo que guarda Product.price
  const usdcBefore = BigInt(await Balances.getBalanceOf(PaymentToken.USDC, buyer));

  const buyTx = await Products.buyProductsTx([created.tokenId], [AMOUNT], DELIVERY_USD, buyer);
  console.log('④ buy_products preparado');
  const { hash: buyHash } = await submitter.submitSigned(
    signAsWallet(buyTx.xdr, BUYER_SECRET, passphrase)
  );
  console.log('   hash', buyHash);

  await Products.verifyBuyProductEvents([created.tokenId], [AMOUNT], buyer, buyHash);
  console.log('   verifyBuyProductEvents ✓');
  await Products.verifyDeliveryPayment(ORDER_TOTAL_USD, DELIVERY_USD, buyHash);
  console.log('   verifyDeliveryPayment ✓');

  const usdcAfter = BigInt(await Balances.getBalanceOf(PaymentToken.USDC, buyer));
  const paid = usdcBefore - usdcAfter;
  const expected = usdToStroops(ORDER_TOTAL_USD + DELIVERY_USD);
  console.log('   pagado', stroopsToUsd(paid), 'USDC | esperado', stroopsToUsd(expected));
  if (paid !== expected) throw new Error('el cobro no coincide');

  // ── cobrar ──────────────────────────────────────────────────────────────
  const claimBalance = await Balances.getClaimBalance(producer);
  console.log('⑤ saldo del vendedor:', stroopsToUsd(claimBalance), 'USDC');
  if (BigInt(claimBalance) < usdToStroops(PRICE_USD * AMOUNT)) {
    throw new Error('el saldo del vendedor no incluye esta venta');
  }

  const claimTx = await Balances.claimSellerPayments(producer);
  const { hash: claimHash } = await submitter.submitSigned(
    signAsWallet(claimTx.xdr, PRODUCER_SECRET, passphrase)
  );
  console.log('   cobrado en', claimHash, '| saldo ahora:', await Balances.getClaimBalance(producer));

  // ── panel admin ─────────────────────────────────────────────────────────
  const info = await Env.getStadisticsInContracts();
  console.log('⑥ contracts_info:', JSON.stringify(info, null, 2));
  if ('cofiCollection' in info || 'swap' in info) throw new Error('quedaron claves de contratos eliminados');

  console.log('\n✅ los flujos de checkout pasan contra testnet');
}

main().catch((error) => {
  console.error('\n❌', error);
  process.exit(1);
});
