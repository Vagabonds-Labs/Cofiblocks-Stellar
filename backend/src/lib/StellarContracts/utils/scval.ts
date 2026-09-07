import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';

import { ROLES, ROLE_DISCRIMINANTS } from '../types/contracts';

/**
 * Conversión a `ScVal`, el formato de argumentos de Soroban.
 *
 * Reemplaza al armado de calldata de Starknet. Los `u256` partidos en
 * `low`/`high` desaparecen: `i128` y `u128` son nativos.
 */

export function addressVal(address: string): xdr.ScVal {
	return Address.fromString(address).toScVal();
}

/** `Option<Address>`: Soroban codifica `None` como `Void`. */
export function optionalAddressVal(address: string | null | undefined): xdr.ScVal {
	return address ? addressVal(address) : xdr.ScVal.scvVoid();
}

export function u32Val(value: number): xdr.ScVal {
	return nativeToScVal(Math.trunc(value), { type: 'u32' });
}

export function u128Val(value: bigint | string | number): xdr.ScVal {
	return nativeToScVal(BigInt(value), { type: 'u128' });
}

export function i128Val(value: bigint | string | number): xdr.ScVal {
	return nativeToScVal(BigInt(value), { type: 'i128' });
}

export function stringVal(value: string): xdr.ScVal {
	return nativeToScVal(value, { type: 'string' });
}

export function vecVal(values: xdr.ScVal[]): xdr.ScVal {
	return xdr.ScVal.scvVec(values);
}

/**
 * Los enum de contrato sin payload se serializan como el entero de su variante.
 * El orden está fijado en `contracts/interfaces/src/lib.rs`.
 */
export function roleVal(role: ROLES): xdr.ScVal {
	const discriminant = ROLE_DISCRIMINANTS[role];
	if (discriminant === undefined) {
		throw new Error(`Unknown role: ${role}`);
	}
	return u32Val(discriminant);
}
