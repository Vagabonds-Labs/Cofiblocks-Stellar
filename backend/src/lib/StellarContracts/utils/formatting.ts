import { StrKey } from '@stellar/stellar-sdk';

/**
 * USDC en Stellar es un activo clásico y los activos clásicos usan 7 decimales.
 * Verificado llamando a `decimals()` del SAC en mainnet y testnet
 * (`scripts/verify-stellar-constants.mjs`). Un error acá es un error de 10× en
 * cada precio del marketplace.
 */
export const USDC_DECIMALS = 7;

const USDC_UNIT = 10 ** USDC_DECIMALS;

/**
 * Convierte USD a la unidad mínima de USDC (stroops).
 *
 * Reemplaza al viejo `usdToWei`, que multiplicaba por 1e6. Los montos ya no se
 * parten en `low`/`high`: `i128` es nativo.
 */
export function usdToStroops(amount: number): bigint {
	return BigInt(Math.round(amount * USDC_UNIT));
}

export function stroopsToUsd(amount: bigint | string): number {
	return Number(BigInt(amount)) / USDC_UNIT;
}

/** XLM también usa 7 decimales. */
export const xlmToStroops = usdToStroops;
export const stroopsToXlm = stroopsToUsd;

/**
 * Las direcciones StrKey son base32 en mayúsculas: alcanza con comparar el texto
 * normalizado. No hay ceros a la izquierda que recortar como en Starknet.
 */
export function isSameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
	if (!a || !b) return false;
	return a.trim().toUpperCase() === b.trim().toUpperCase();
}

/** Cuenta clásica `G…`: la única que soporta v1. */
export function isClassicAddress(address: string): boolean {
	return StrKey.isValidEd25519PublicKey(address);
}

/** Cuenta contrato `C…`: smart wallets y passkeys. */
export function isContractAddress(address: string): boolean {
	return StrKey.isValidContract(address);
}

export function isValidAddress(address: string): boolean {
	return isClassicAddress(address) || isContractAddress(address);
}

/**
 * El precio que guarda Postgres incluye el fee de mercado (5 000 bps = 50 %).
 * Esto devuelve lo que efectivamente cobra el vendedor.
 */
export function getPriceWithoutMarketplaceFee(price: number): number {
	return price / 1.5;
}
