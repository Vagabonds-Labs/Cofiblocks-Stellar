import { scValToNative, Transaction, xdr } from '@stellar/stellar-sdk';

import { getContractAddress } from '../deployments';
import { StellarClient } from '../StellarClient';
import { TxBuilder } from '../TxBuilder';
import { StellarContract } from '../types/contracts';
import { addressVal, u32Val } from '../utils/scval';

/** Lo que devuelve cada página de `distribute`. */
export interface DistributeProgress {
  phase: number;
  next_cursor: number;
  processed: number;
  done: boolean;
}

export class Distribution {
  public readonly contractAddress: string;

  private readonly builder: TxBuilder;

  constructor(private readonly client: StellarClient) {
    this.contractAddress = getContractAddress(client.network, StellarContract.DISTRIBUTION);
    this.builder = new TxBuilder(client);
  }

  private call(method: string, args: xdr.ScVal[] = []) {
    return { contractId: this.contractAddress, method, args, kind: 'distribution' as const };
  }

  /**
   * Totales del epoch en curso.
   *
   * En Starknet había que leer el storage crudo con selectores hardcodeados
   * (`readStorageAt(0x01a31d9b…)`); acá el contrato expone getters.
   */
  public async getTotalProfit(): Promise<bigint> {
    const result = await this.builder.read<xdr.ScVal>(this.call('get_total_profit'));
    return BigInt(scValToNative(result) ?? 0);
  }

  public async getTotalPurchases(): Promise<bigint> {
    const result = await this.builder.read<xdr.ScVal>(this.call('get_total_purchases'));
    return BigInt(scValToNative(result) ?? 0);
  }

  /**
   * Una página del reparto. Hay que repetir con el `next_cursor` que devuelve
   * hasta recibir `done: true`.
   *
   * Es paginado porque el `distribute()` de Cairo iteraba sobre listas sin cota
   * y Soroban corta por presupuesto de CPU, memoria y footprint.
   */
  public distribute(cursor: number, limit: number): Promise<Transaction> {
    return this.builder.prepareAsService(
      this.call('distribute', [u32Val(cursor), u32Val(limit)])
    );
  }

  /** Reparto en curso, si lo hay. Lo usa el panel admin para retomar. */
  public async getRun(): Promise<Record<string, unknown> | null> {
    const result = await this.builder.read<xdr.ScVal>(this.call('get_run'));
    const value = scValToNative(result);
    return value ? (value as Record<string, unknown>) : null;
  }

  public async getEpoch(): Promise<number> {
    const result = await this.builder.read<xdr.ScVal>(this.call('get_epoch'));
    return Number(scValToNative(result));
  }

  public async coffeeLoverClaimBalance(address: string): Promise<bigint> {
    const result = await this.builder.read<xdr.ScVal>(
      this.call('coffee_lover_claim_balance', [addressVal(address)])
    );
    return BigInt(scValToNative(result) ?? 0);
  }

  public async producerClaimBalance(address: string): Promise<bigint> {
    const result = await this.builder.read<xdr.ScVal>(
      this.call('producer_claim_balance', [addressVal(address)])
    );
    return BigInt(scValToNative(result) ?? 0);
  }

  public async roasterClaimBalance(address: string): Promise<bigint> {
    const result = await this.builder.read<xdr.ScVal>(
      this.call('roaster_claim_balance', [addressVal(address)])
    );
    return BigInt(scValToNative(result) ?? 0);
  }
}
