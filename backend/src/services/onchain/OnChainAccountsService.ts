import { Asset, BASE_FEE, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

import { ContractFactory } from '@/lib/StellarContracts';
import { PreparedTransaction } from '@/lib/StellarContracts/types/transactions';
import { isClassicAddress, usdToStroops } from '@/lib/StellarContracts/utils';
import { hasUSDCTrustline } from './OnChainBalancesService';
import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';

const contractFactory = new ContractFactory();

const TRUSTLINE_VALIDITY_SECONDS = 5 * 60;

/**
 * Trustlines patrocinadas.
 *
 * En Stellar una cuenta necesita trustline a USDC para poder recibirlo, y abrir
 * una inmoviliza reservas en XLM. Con `beginSponsoringFutureReserves` /
 * `endSponsoringFutureReserves` esas reservas las pone el backend, así el
 * usuario no necesita XLM. Es la otra mitad de lo que reemplaza a Cavos: el
 * fee-bump paga los fees, esto paga las reservas.
 *
 * Si la cuenta todavía no existe — una wallet recién creada, sin un solo XLM,
 * no existe en la red — la misma transacción la crea con saldo 0 y la reserva
 * base también patrocinada. Sin eso, "comprar sin tener XLM" no era posible.
 */
export async function buildSponsoredUSDCTrustlineTx(
  userAddress: string
): Promise<PreparedTransaction> {
  if (!isClassicAddress(userAddress)) {
    throw new HttpException(
      400,
      'Only classic Stellar accounts (G…) are supported',
      'UNSUPPORTED_ACCOUNT_TYPE'
    );
  }

  const client = contractFactory.getClient();
  const sponsor = client.getServiceKeypair();
  const usdc = contractFactory.getUSDCService();
  const asset = new Asset('USDC', usdc.issuer);

  const sponsorAccount = await client.rpc.getAccount(sponsor.publicKey());
  const accountExists = await existsOnNetwork(userAddress);

  // El patrocinador es la source account: pone las reservas y paga el fee.
  // El usuario firma las operaciones que le corresponden.
  const builder = new TransactionBuilder(sponsorAccount, {
    fee: BASE_FEE,
    networkPassphrase: client.networkPassphrase,
  }).addOperation(
    Operation.beginSponsoringFutureReserves({ sponsoredId: userAddress })
  );

  if (!accountExists) {
    // Saldo inicial 0: sólo es válido porque la reserva base queda patrocinada.
    builder.addOperation(
      Operation.createAccount({ destination: userAddress, startingBalance: '0' })
    );
  }

  const tx = builder
    .addOperation(Operation.changeTrust({ asset, source: userAddress }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: userAddress }))
    .setTimeout(TRUSTLINE_VALIDITY_SECONDS)
    .build();

  tx.sign(sponsor);

  logger.info(
    { userAddress, createsAccount: !accountExists },
    'Built sponsored USDC trustline transaction'
  );

  return {
    xdr: tx.toXDR(),
    network_passphrase: client.networkPassphrase,
    valid_until: Math.floor(Date.now() / 1000) + TRUSTLINE_VALIDITY_SECONDS,
  };
}

/** `true` si la cuenta ya existe en la red. */
async function existsOnNetwork(address: string): Promise<boolean> {
  return (await contractFactory.getClient().loadAccountOrNull(address)) !== null;
}

/**
 * Envía la trustline patrocinada ya co-firmada por el usuario.
 *
 * No la envuelve en un fee-bump: el patrocinador ya es la source account, así
 * que el fee lo paga él.
 */
export async function submitSponsoredTrustline(signedXdr: string): Promise<string> {
  const { hash } = await contractFactory
    .getTxSubmitter()
    .submitSigned(signedXdr, { feeBump: false });
  return hash;
}

/** Lo que entrega el botón de USDC de prueba del perfil. */
const TESTNET_FAUCET_AMOUNT_USD = 100;

/**
 * Por encima de este saldo no se emite más. Emitir no tiene límite de oferta,
 * pero cada envío le cuesta XLM de fee al backend: el tope evita que un botón
 * apretado en loop vacíe la cuenta que paga los fee-bumps.
 */
const TESTNET_FAUCET_MAX_BALANCE_USD = 1000;

/**
 * 100 USDC de prueba para la cuenta del usuario. Sólo en testnet.
 *
 * Es el reemplazo del "Get $100 Sepolia Tokens" de Starknet. Emite con `mint`
 * del SAC propio de testnet, cuyo admin es la cuenta del backend.
 */
export async function sendTestnetUSDC(
  walletAddress: string
): Promise<{ tx_hash: string; amount: number }> {
  if (contractFactory.getNetwork() !== 'testnet') {
    throw new HttpException(403, 'Test USDC is only available on testnet', 'TESTNET_ONLY');
  }
  // Sin trustline el SAC rechaza el mint; mejor decirlo antes que gastar un fee.
  if (!(await hasUSDCTrustline(walletAddress))) {
    throw new HttpException(400, 'The account has no USDC trustline', 'USDC_TRUSTLINE_MISSING');
  }

  const usdc = contractFactory.getUSDCService();
  if ((await usdc.balance(walletAddress)) >= usdToStroops(TESTNET_FAUCET_MAX_BALANCE_USD)) {
    throw new HttpException(
      400,
      `The account already holds ${TESTNET_FAUCET_MAX_BALANCE_USD} test USDC or more`,
      'TESTNET_FAUCET_LIMIT'
    );
  }

  const tx = await usdc.mint(walletAddress, usdToStroops(TESTNET_FAUCET_AMOUNT_USD));
  const { hash } = await contractFactory.getTxSubmitter().submitAsService(tx);
  logger.info({ walletAddress, hash }, `Minted ${TESTNET_FAUCET_AMOUNT_USD} test USDC`);

  return { tx_hash: hash, amount: TESTNET_FAUCET_AMOUNT_USD };
}
