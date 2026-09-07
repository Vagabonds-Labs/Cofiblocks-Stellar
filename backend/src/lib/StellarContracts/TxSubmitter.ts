import { rpc, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';
import { StellarClient } from './StellarClient';
import { toDomainError } from './errors';
import { SubmittedTransaction } from './types/transactions';

/** Fee que pone el backend al envolver la transacción del usuario, en stroops. */
const FEE_BUMP_BASE_FEE = '100000';

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 45_000;

/**
 * Recibe la transacción firmada por el usuario, la envuelve en un fee-bump y la
 * manda a la red.
 *
 * El fee-bump es lo que reemplaza a Cavos: el backend paga el fee con su propia
 * cuenta, así el comprador nunca necesita tener XLM. También es de acá de donde
 * sale el hash — más confiable que confiar en el que reporte el cliente.
 */
export class TxSubmitter {
  constructor(private readonly client: StellarClient) {}

  /**
   * Envía una transacción firmada por el usuario, pagando el fee el backend.
   *
   * `feeBump: false` sirve para las transacciones donde el backend ya es la
   * source account y por lo tanto ya paga el fee — por ejemplo una trustline
   * patrocinada.
   */
  public async submitSigned(
    signedXdr: string,
    options: { feeBump?: boolean } = {}
  ): Promise<SubmittedTransaction> {
    let inner: Transaction;
    try {
      inner = TransactionBuilder.fromXDR(
        signedXdr,
        this.client.networkPassphrase
      ) as Transaction;
    } catch (error) {
      logger.error({ error }, 'Could not decode signed transaction XDR');
      throw new HttpException(400, 'Invalid signed transaction', 'INVALID_SIGNED_TX');
    }

    if (!inner.signatures || inner.signatures.length === 0) {
      throw new HttpException(400, 'Transaction is not signed', 'UNSIGNED_TRANSACTION');
    }

    if (options.feeBump === false) {
      return this.send(inner.toXDR());
    }

    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      this.client.getServiceKeypair(),
      FEE_BUMP_BASE_FEE,
      inner,
      this.client.networkPassphrase
    );
    feeBump.sign(this.client.getServiceKeypair());

    return this.send(feeBump.toXDR());
  }

  /** Envía una transacción que ya firmó el backend (roles, reparto). */
  public async submitAsService(tx: Transaction): Promise<SubmittedTransaction> {
    return this.send(tx.toXDR());
  }

  private async send(envelopeXdr: string): Promise<SubmittedTransaction> {
    const tx = TransactionBuilder.fromXDR(envelopeXdr, this.client.networkPassphrase);
    const response = await this.client.rpc.sendTransaction(tx);

    if (response.status === 'ERROR') {
      const detail = JSON.stringify(response.errorResult ?? {});
      logger.error({ detail }, 'Soroban rejected the transaction on submit');
      throw toDomainError(detail);
    }
    if (response.status === 'DUPLICATE') {
      logger.info({ hash: response.hash }, 'Transaction already submitted, polling for result');
    }

    return this.waitForConfirmation(response.hash);
  }

  private async waitForConfirmation(hash: string): Promise<SubmittedTransaction> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const result = await this.client.rpc.getTransaction(hash);

      if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return { hash, ledger: result.ledger };
      }
      if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
        const detail = JSON.stringify(result.resultXdr ?? {});
        logger.error({ hash, detail }, 'Transaction failed on chain');
        throw toDomainError(detail);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new HttpException(
      504,
      'Timed out waiting for the transaction to be confirmed',
      'TRANSACTION_TIMEOUT'
    );
  }
}
