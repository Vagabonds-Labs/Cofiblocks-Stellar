import { scValToNative, xdr } from '@stellar/stellar-sdk';

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

  private call(method: string, args: xdr.ScVal[] = []) {
    return { contractId: this.contractAddress, method, args };
  }

  public async balance(address: string): Promise<bigint> {
    const result = await this.builder.read<xdr.ScVal>(
      this.call('balance', [addressVal(address)])
    );
    return BigInt(scValToNative(result) ?? 0);
  }

  /** Confirma contra la red los decimales de los que dependen todos los precios. */
  public async getDecimals(): Promise<number> {
    const result = await this.builder.read<xdr.ScVal>(this.call('decimals'));
    return Number(scValToNative(result));
  }

  public transfer(from: string, to: string, amount: bigint): Promise<PreparedTransaction> {
    return this.builder.prepare(
      from,
      this.call('transfer', [addressVal(from), addressVal(to), i128Val(amount)])
    );
  }
}
