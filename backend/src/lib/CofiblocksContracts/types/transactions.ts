import { ArgsOrCalldata } from "starknet";

export enum PaymentToken {
	STRK = "STRK",
	USDC = "USDC",
	USDT = "USDT",
}

export enum SwapToken {
	STRK = "STRK",
	USDC_BRIDGED = "USDC_BRIDGED",
	USDT = "USDT",
}

export interface TransactionDetails {
	contract_address: string;
	entrypoint: string;
	calldata: ArgsOrCalldata;
}

export enum TransactionType {
	READ = "read",
	WRITE = "write",
}
