import { rpc, scValToNative, StrKey, xdr } from '@stellar/stellar-sdk';

import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';
import { StellarClient } from './StellarClient';
import { ROLE_DISCRIMINANTS, ROLES } from './types/contracts';
import {
  AssignRoleEvent,
  BuyBatchEvent,
  BuyProductEvent,
  CheckoutEvents,
  CreateProductEvents,
  MarketplaceEventType,
  MarketplaceEvents,
  PaymentSellerEvent,
  RawEvent,
  UpdateStockEvent,
} from './types/events';

/** Un evento de contrato ya traducido a tipos de JS. */
interface DecodedEvent {
  contractId: string;
  /** Primer topic: el nombre legible del evento. */
  name: string;
  /** Topics restantes, ya nativos. */
  keys: unknown[];
  /** Sección de datos: un mapa indexado por nombre de campo. */
  data: Record<string, unknown>;
}

const ROLE_BY_DISCRIMINANT: Record<number, ROLES> = Object.fromEntries(
  Object.entries(ROLE_DISCRIMINANTS).map(([role, value]) => [value, role as ROLES])
) as Record<number, ROLES>;

/** `bigint | number | string` → `string`, que es lo que compara el backend. */
function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'bigint' ? value.toString() : String(value);
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str) : [];
}

export class EventsParser {
  constructor(
    private readonly events: DecodedEvent[],
    private readonly isError: boolean = false
  ) {}

  public getEvents(): RawEvent[] {
    return this.events.map((event) => ({
      contractId: event.contractId,
      name: event.name,
      topics: event.keys,
      data: event.data,
    }));
  }

  public getIsError(): boolean {
    return this.isError;
  }

  private byName(name: string): DecodedEvent[] {
    return this.events.filter((event) => event.name === name);
  }

  public parseCreateProductEvents(): CreateProductEvents {
    const event = this.byName('create_product')[0];
    if (!event) {
      return { createProduct: null };
    }
    return {
      createProduct: {
        // El token_id viaja como topic, no como campo de datos.
        token_id: str(event.keys[0]),
        initial_stock: str(event.data.initial_stock),
        owner: str(event.data.owner),
        price: str(event.data.price),
      },
    };
  }

  public parseAssignRoleEvents(): AssignRoleEvent {
    const event = this.byName('assign_role')[0];
    if (!event) {
      return { role: '', account: '' };
    }
    const discriminant = Number(event.keys[0]);
    return {
      role: ROLE_BY_DISCRIMINANT[discriminant] ?? '',
      account: str(event.data.assignee),
    };
  }

  public parseCheckoutEvents(): CheckoutEvents {
    const buyProduct: BuyProductEvent[] = this.byName('buy_product').map((event) => ({
      token_id: str(event.keys[0]),
      amount: str(event.data.amount),
      buyer: str(event.data.buyer),
    }));

    const paymentSeller: PaymentSellerEvent[] = this.byName('payment_seller').map((event) => ({
      seller: str(event.keys[0]),
      token_ids: [str(event.data.token_id)],
      payment: str(event.data.payment),
    }));

    const updateStock: UpdateStockEvent[] = this.byName('update_stock').map((event) => ({
      token_id: str(event.keys[0]),
      new_stock: str(event.data.new_stock),
    }));

    const batchEvent = this.byName('buy_batch')[0];
    const buyBatch: BuyBatchEvent | null = batchEvent
      ? {
          buyer: str(batchEvent.keys[0]),
          token_ids: strArray(batchEvent.data.token_ids),
          amounts: strArray(batchEvent.data.amounts),
          total_paid: str(batchEvent.data.total_paid),
          delivery_fee: str(batchEvent.data.delivery_fee),
        }
      : null;

    return { buyProduct, paymentSeller, updateStock, buyBatch };
  }

  public parseEvents(eventsType: MarketplaceEventType): MarketplaceEvents {
    if (this.isError) {
      return [];
    }
    switch (eventsType) {
      case 'CREATE_PRODUCT':
        return this.parseCreateProductEvents();
      case 'ASSIGN_ROLE':
      case 'REVOKE_ROLE':
        return this.parseAssignRoleEvents();
      case 'CHECKOUT':
        return this.parseCheckoutEvents();
      default:
        return this.getEvents();
    }
  }
}

/**
 * Lee los eventos que emitió una transacción.
 *
 * En Soroban los topics son símbolos legibles y la sección de datos es un mapa
 * indexado por nombre de campo: se terminaron los selectores hexadecimales
 * hardcodeados que hacían falta en Starknet.
 *
 * **Retención:** el RPC de Soroban guarda los eventos alrededor de 7 días y las
 * transacciones bastante menos. La verificación inmediata que hace el backend
 * sigue funcionando, pero cualquier reproceso tardío tiene que apoyarse en lo
 * que ya está persistido en Postgres.
 */
export class EventsClient {
  private readonly client: StellarClient;

  constructor(client?: StellarClient) {
    this.client = client ?? new StellarClient();
  }

  public async getTransactionEvents(txHash: string): Promise<EventsParser> {
    let result: rpc.Api.GetTransactionResponse;
    try {
      result = await this.client.rpc.getTransaction(txHash);
    } catch (error) {
      logger.error({ error, txHash }, 'Could not fetch transaction from Soroban RPC');
      throw new HttpException(400, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
    }

    if (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      throw new HttpException(400, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      return new EventsParser([], true);
    }

    return new EventsParser(decodeContractEvents(result));
  }
}

/** El contractId llega como wrapper con bytes o ya como StrKey. */
function toContractId(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  const value = (raw as { value?: Uint8Array })?.value;
  return value ? StrKey.encodeContract(Buffer.from(value)) : '';
}

function decodeContractEvents(result: rpc.Api.GetSuccessfulTransactionResponse): DecodedEvent[] {
  const raw = result.events?.contractEventsXdr;
  if (!raw) {
    return [];
  }

  const decoded: DecodedEvent[] = [];
  for (const event of raw.flat()) {
    try {
      const body = (event as unknown as { body: { v0: { topics: xdr.ScVal[]; data: xdr.ScVal } } })
        .body.v0;
      const topics = body.topics.map((topic) => scValToNative(topic));
      const data = scValToNative(body.data);
      decoded.push({
        contractId: toContractId((event as unknown as { contractId: unknown }).contractId),
        name: str(topics[0]),
        keys: topics.slice(1),
        data: (data ?? {}) as Record<string, unknown>,
      });
    } catch (error) {
      // Un evento que no sabemos leer (por ejemplo del SAC) no debe tumbar el parseo.
      logger.debug({ error }, 'Skipping unparseable contract event');
    }
  }
  return decoded;
}
