import { HttpException } from '@/exceptions/HttpException';

/**
 * Códigos de error del contrato `marketplace` (ver `contracts/marketplace/src/types.rs`).
 *
 * Soroban los devuelve en la simulación como `Error(Contract, #N)`. Traducirlos
 * acá es lo que permite que la API siga respondiendo errores de dominio con la
 * misma forma que en Starknet, en vez de un fallo opaco de RPC.
 */
const MARKETPLACE_ERRORS: Record<number, { status: number; code: string; message: string }> = {
  1: { status: 500, code: 'ALREADY_INITIALIZED', message: 'Contract already initialized' },
  2: { status: 500, code: 'NOT_INITIALIZED', message: 'Contract not initialized' },
  3: { status: 403, code: 'UNAUTHORIZED', message: 'Caller does not have the required role' },
  4: { status: 403, code: 'CALLER_IS_NOT_A_SELLER', message: 'Caller is not a producer or roaster' },
  5: { status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found on chain' },
  6: { status: 400, code: 'PRODUCT_NOT_AVAILABLE', message: 'Product is not available' },
  7: { status: 403, code: 'NOT_YOUR_PRODUCT', message: 'Caller is not the owner of this product' },
  8: { status: 400, code: 'NOT_ENOUGH_STOCK', message: 'Not enough stock' },
  9: { status: 400, code: 'INVALID_STOCK', message: 'Stock must be between 1 and 1000' },
  10: { status: 400, code: 'INVALID_PRICE', message: 'Price must be greater than 0' },
  11: { status: 400, code: 'INVALID_AMOUNT', message: 'Invalid amount' },
  12: { status: 400, code: 'FEE_TOO_LOW', message: 'Price is too low for the market fee' },
  13: { status: 400, code: 'INVALID_PURCHASE', message: 'Invalid purchase: empty, mismatched or duplicated items' },
  14: { status: 400, code: 'TOO_MANY_ITEMS', message: 'Too many items in a single purchase' },
  15: { status: 400, code: 'NO_TOKENS_TO_CLAIM', message: 'No tokens to claim' },
  16: { status: 500, code: 'CONTRACT_INSUFFICIENT_BALANCE', message: 'Contract has insufficient balance' },
};

/** Códigos del contrato `distribution`. */
const DISTRIBUTION_ERRORS: Record<number, { status: number; code: string; message: string }> = {
  1: { status: 500, code: 'ALREADY_INITIALIZED', message: 'Contract already initialized' },
  2: { status: 500, code: 'NOT_INITIALIZED', message: 'Contract not initialized' },
  3: { status: 403, code: 'UNAUTHORIZED', message: 'Caller is not authorized' },
  4: { status: 409, code: 'INVALID_CURSOR', message: 'Distribution cursor does not match the expected one' },
  5: { status: 400, code: 'NOTHING_TO_DISTRIBUTE', message: 'There is no profit to distribute' },
  6: { status: 400, code: 'INVALID_AMOUNT', message: 'Invalid amount' },
};

export type ContractKind = 'marketplace' | 'distribution';

/** Extrae el `#N` de un `Error(Contract, #N)`. */
export function parseContractErrorCode(raw: string): number | null {
  const match = /Error\(Contract, #(\d+)\)/.exec(raw);
  return match ? Number(match[1]) : null;
}

/**
 * Una entrada de storage archivada hace fallar la simulación hasta que alguien
 * la restaure. Es un modo de fallo que Starknet no tenía, así que hay que
 * distinguirlo explícitamente en vez de dejarlo caer como error genérico.
 */
export function isArchivedStateError(raw: string): boolean {
  return /archived|ExceededLimit.*Storage|entry (is |has been )?expired/i.test(raw);
}

export function toDomainError(raw: string, kind: ContractKind = 'marketplace'): HttpException {
  if (isArchivedStateError(raw)) {
    return new HttpException(
      409,
      'On-chain state is archived and needs to be restored before this operation',
      'STATE_ARCHIVED'
    );
  }

  const code = parseContractErrorCode(raw);
  if (code !== null) {
    const table = kind === 'distribution' ? DISTRIBUTION_ERRORS : MARKETPLACE_ERRORS;
    const known = table[code];
    if (known) {
      return new HttpException(known.status, known.message, known.code);
    }
    return new HttpException(400, `Contract error #${code}`, 'CONTRACT_ERROR');
  }

  return new HttpException(502, `Transaction simulation failed: ${raw}`, 'SIMULATION_FAILED');
}
