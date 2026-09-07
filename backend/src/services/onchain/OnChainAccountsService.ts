import { Asset, BASE_FEE, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

import { ContractFactory } from '@/lib/StellarContracts';
import { PreparedTransaction } from '@/lib/StellarContracts/types/transactions';
import { isClassicAddress } from '@/lib/StellarContracts/utils';
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

  // El patrocinador es la source account: pone las reservas y paga el fee.
  // El usuario firma las dos operaciones que le corresponden.
  const tx = new TransactionBuilder(sponsorAccount, {
    fee: BASE_FEE,
    networkPassphrase: client.networkPassphrase,
  })
    .addOperation(
      Operation.beginSponsoringFutureReserves({ sponsoredId: userAddress })
    )
    .addOperation(Operation.changeTrust({ asset, source: userAddress }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: userAddress }))
    .setTimeout(TRUSTLINE_VALIDITY_SECONDS)
    .build();

  tx.sign(sponsor);

  logger.info({ userAddress }, 'Built sponsored USDC trustline transaction');

  return {
    xdr: tx.toXDR(),
    network_passphrase: client.networkPassphrase,
    valid_until: Math.floor(Date.now() / 1000) + TRUSTLINE_VALIDITY_SECONDS,
  };
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
