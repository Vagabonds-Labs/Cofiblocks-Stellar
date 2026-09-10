import { scValToNative, Transaction, xdr } from '@stellar/stellar-sdk';

import { HttpException } from '@/exceptions/HttpException';

import { getDeployment } from '../deployments';
import { StellarClient } from '../StellarClient';
import { TxBuilder } from '../TxBuilder';
import { PreparedTransaction } from '../types/transactions';
import { addressVal, i128Val } from '../utils/scval';

/**
 * SAC de USDC.
 *
 * No hay `approve` ni `transfer_from`: en Soroban la autorización viaja por el
 * árbol de invocación, así que el marketplace cobra directamente con
 * `usdc.transfer(&buyer, …)` cubierto por la firma de la transacción.
 */
export class Token {
  public readonly contractAddress: string;
  public readonly issuer: string;
  public readonly decimals: number;

  private readonly builder: TxBuilder;

  constructor(client: StellarClient) {
    const usdc = getDeployment(client.network).USDC;
    this.contractAddress = usdc.address;
    this.issuer = usdc.issuer;
    this.decimals = usdc.decimals;
    this.builder = new TxBuilder(client);
  }

  // `kind: 'token'` hace que los errores se lean con la tabla del SAC: sus
  // códigos se pisan con los del marketplace (el #13 es "falta trustline" acá y
  // "compra inválida" allá).
  private call(method: string, args: xdr.ScVal[] = []) {
    return { contractId: this.contractAddress, method, args, kind: 'token' as const };
  }

  /**
   * Saldo de USDC. Una cuenta sin trustline — o que todavía no existe en la
   * red — tiene 0 USDC: no es un error, el SAC simplemente no tiene dónde leer.
   */
  public async balance(address: string): Promise<bigint> {
    try {
      const result = await this.builder.read<xdr.ScVal>(
        this.call('balance', [addressVal(address)])
      );
      return BigInt(scValToNative(result) ?? 0);
    } catch (error) {
      if (error instanceof HttpException && error.code === 'USDC_TRUSTLINE_MISSING') {
        return 0n;
      }
      throw error;
    }
  }

  /** Confirma contra la red los decimales de los que dependen todos los precios. */
  public async getDecimals(): Promise<number> {
    const result = await this.builder.read<xdr.ScVal>(this.call('decimals'));
    return Number(scValToNative(result));
  }

  /**
   * Emite USDC. La firma el backend, así que sólo funciona si su cuenta es admin
   * del SAC — cosa que únicamente pasa con el USDC propio de testnet. En mainnet
   * el admin del USDC es Circle y esta llamada falla sola.
   */
  public mint(to: string, amount: bigint): Promise<Transaction> {
    return this.builder.prepareAsService(this.call('mint', [addressVal(to), i128Val(amount)]));
  }

  public transfer(from: string, to: string, amount: bigint): Promise<PreparedTransaction> {
    return this.builder.prepare(
      from,
      this.call('transfer', [addressVal(from), addressVal(to), i128Val(amount)])
    );
  }
}
