import { scValToNative, Transaction, xdr } from '@stellar/stellar-sdk';

import { getContractAddress } from '../deployments';
import { StellarClient } from '../StellarClient';
import { TxBuilder } from '../TxBuilder';
import { ListedProduct, ROLES, StellarContract } from '../types/contracts';
import { PreparedTransaction } from '../types/transactions';
import {
  addressVal,
  i128Val,
  optionalAddressVal,
  roleVal,
  stringVal,
  u128Val,
  u32Val,
  vecVal,
} from '../utils/scval';

/**
 * Envoltorio del contrato `marketplace`.
 *
 * Las escrituras que hace el usuario devuelven una `PreparedTransaction` (XDR ya
 * simulado) para que la firme su wallet. Las que hace el backend devuelven una
 * `Transaction` firmada, lista para que la envíe `TxSubmitter`.
 */
export class Marketplace {
  public readonly contractAddress: string;

  private readonly builder: TxBuilder;

  constructor(private readonly client: StellarClient) {
    this.contractAddress = getContractAddress(client.network, StellarContract.MARKETPLACE);
    this.builder = new TxBuilder(client);
  }

  private call(method: string, args: xdr.ScVal[] = []) {
    return { contractId: this.contractAddress, method, args, kind: 'marketplace' as const };
  }

  // ── roles ───────────────────────────────────────────────────────────────

  /** La firma el backend: `assign_role` exige el admin del contrato. */
  public assignRole(role: ROLES, account: string): Promise<Transaction> {
    return this.builder.prepareAsService(
      this.call('assign_role', [roleVal(role), addressVal(account)])
    );
  }

  public revokeRole(role: ROLES, account: string): Promise<Transaction> {
    return this.builder.prepareAsService(
      this.call('account_revoke_role', [roleVal(role), addressVal(account)])
    );
  }

  public async accountHasRole(role: ROLES, account: string): Promise<boolean> {
    const result = await this.builder.read<xdr.ScVal>(
      this.call('account_has_role', [roleVal(role), addressVal(account)])
    );
    return Boolean(scValToNative(result));
  }

  // ── productos ───────────────────────────────────────────────────────────

  public createProduct(
    seller: string,
    initialStock: number,
    price: bigint,
    associatedProducer: string | null,
    shortDescription: string
  ): Promise<PreparedTransaction> {
    return this.builder.prepare(
      seller,
      this.call('create_product', [
        addressVal(seller),
        u32Val(initialStock),
        i128Val(price),
        optionalAddressVal(associatedProducer),
        stringVal(shortDescription),
      ])
    );
  }

  public addStock(seller: string, tokenId: string, amount: number): Promise<PreparedTransaction> {
    return this.builder.prepare(
      seller,
      this.call('add_stock', [addressVal(seller), u128Val(tokenId), u32Val(amount)])
    );
  }

  public deleteProduct(seller: string, tokenId: string): Promise<PreparedTransaction> {
    return this.builder.prepare(
      seller,
      this.call('delete_product', [addressVal(seller), u128Val(tokenId)])
    );
  }

  public async getProduct(tokenId: string): Promise<ListedProduct> {
    const result = await this.builder.read<xdr.ScVal>(
      this.call('get_product', [u128Val(tokenId)])
    );
    const raw = scValToNative(result) as Record<string, unknown>;
    return {
      token_id: String(raw.token_id),
      stock: Number(raw.stock),
      sells: Number(raw.sells),
      price_usdc: String(raw.price_usdc),
      price_usdc_with_fee: String(raw.price_usdc_with_fee),
      is_producer: Boolean(raw.is_producer),
      owner: String(raw.owner),
      associated_producer: raw.associated_producer ? String(raw.associated_producer) : null,
      short_description: String(raw.short_description),
      is_available: Boolean(raw.is_available),
    };
  }

  /**
   * Extiende el TTL del producto sin modificarlo, para que no se archive.
   * Lo dispara el panel admin.
   */
  public touchProduct(tokenId: string): Promise<Transaction> {
    return this.builder.prepareAsService(this.call('touch_product', [u128Val(tokenId)]));
  }

  // ── compra ──────────────────────────────────────────────────────────────

  /**
   * Compra en lote. Es una sola invocación porque Stellar admite un único
   * `InvokeHostFunction` por transacción: no hay multicall que valga.
   */
  /**
   * `validForSeconds` acota cuánto vive el XDR firmable. El checkout lo deriva
   * del tiempo que le queda a la orden: si la transacción sobreviviera a la
   * orden, el cron podría cancelarla y liberar el stock con el pago ya en vuelo.
   */
  public buyProducts(
    buyer: string,
    tokenIds: string[],
    amounts: number[],
    deliveryFee: bigint,
    validForSeconds?: number
  ): Promise<PreparedTransaction> {
    return this.builder.prepare(
      buyer,
      this.call('buy_products', [
        addressVal(buyer),
        vecVal(tokenIds.map(u128Val)),
        vecVal(amounts.map(u32Val)),
        i128Val(deliveryFee),
      ]),
      validForSeconds
    );
  }

  // ── saldos ──────────────────────────────────────────────────────────────

  public async getSellerBalance(walletAddress: string): Promise<bigint> {
    const result = await this.builder.read<xdr.ScVal>(
      this.call('get_seller_balance', [addressVal(walletAddress)])
    );
    return BigInt(scValToNative(result) ?? 0);
  }

  public withdrawSellerBalance(seller: string): Promise<PreparedTransaction> {
    return this.builder.prepare(
      seller,
      this.call('withdraw_seller_balance', [addressVal(seller)])
    );
  }

  public withdrawDistributionBalance(caller: string, role: ROLES): Promise<PreparedTransaction> {
    return this.builder.prepare(
      caller,
      this.call('withdraw_distribution_balance', [addressVal(caller), roleVal(role)])
    );
  }

  public withdraw(amount: bigint, recipient: string): Promise<Transaction> {
    return this.builder.prepareAsService(
      this.call('withdraw', [i128Val(amount), addressVal(recipient)])
    );
  }

  public async getMarketFee(): Promise<number> {
    const result = await this.builder.read<xdr.ScVal>(this.call('get_market_fee'));
    return Number(scValToNative(result));
  }
}
