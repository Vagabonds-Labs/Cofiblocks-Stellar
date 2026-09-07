/**
 * Tokens que maneja la app.
 *
 * Sólo se paga en USDC. Se fueron STRK, USDT y USDC.e junto con el contrato de
 * swap; XLM queda sólo para mostrar el saldo nativo de la cuenta.
 */
export enum PaymentToken {
    XLM = "XLM",
    USDC = "USDC",
}

/**
 * Transacción que arma el backend, ya simulada, para que la firme la wallet.
 *
 * Reemplaza al `{ contract_address, entrypoint, calldata }` de Starknet: en
 * Stellar se firma una transacción entera, no un calldata.
 */
export interface PreparedTransaction {
    /** Sobre de transacción en base64. */
    xdr: string;
    /** La wallet lo necesita para firmar contra la red correcta. */
    network_passphrase: string;
    /** Unix timestamp en segundos; después de esto la transacción no entra. */
    valid_until: number;
}
