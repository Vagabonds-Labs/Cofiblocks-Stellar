/**
 * Lo que el backend le devuelve al frontend para que la wallet firme.
 *
 * Reemplaza al `{ contract_address, entrypoint, calldata }` de Starknet: en
 * Stellar se firma una transacción entera, no un calldata.
 */
export interface PreparedTransaction {
	/** Sobre de transacción en base64, ya simulado (footprint, auth y fee dentro). */
	xdr: string;
	/** La wallet lo necesita para firmar contra la red correcta. */
	network_passphrase: string;
	/** Unix timestamp en segundos: después de esto la transacción ya no entra. */
	valid_until: number;
}

/** Resultado de enviar una transacción firmada. */
export interface SubmittedTransaction {
	hash: string;
	ledger: number;
}

/** Tokens que la app maneja. Se fueron STRK, USDT y USDC.e. */
export enum PaymentToken {
	XLM = "XLM",
	USDC = "USDC",
}
