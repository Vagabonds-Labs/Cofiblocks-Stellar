const TWO_POW_128 = 0x100000000000000000000000000000000n;

export interface FormattedNumber {
	high: string;
	low: string;
}

export function format_number(n: bigint): FormattedNumber {
	return {
		high: (n / TWO_POW_128).toString(),
		low: (n % TWO_POW_128).toString(),
	};
}

export function starkToWei(amount: number): bigint {
	return BigInt(Math.floor(amount * 1_000_000_000_000_000_000));
}

export function weiToStark(amount: bigint): number {
	return Number(amount) / 1_000_000_000_000_000_000;
}

export function usdToWei(amount: number): bigint {
	return BigInt(Math.floor(amount * 1_000_000));
}

export function weiToUsd(amount: bigint): number {
	return Number(amount) / 1_000_000;
}

export function normalizeAddress(addr: string): string {
	const normalized = addr.toLowerCase().replace(/^0x/, '').replace(/^0+/, '');
	return normalized || '0';
};

export function isSameAddress(addr1: string, addr2: string): boolean {
	return normalizeAddress(addr1) === normalizeAddress(addr2);
};

export function stringToAddress(addr: string): string {
	return '0x' + BigInt(addr).toString(16);
};

export function hexToText(text: bigint): string {
	return Buffer.from(text.toString(16), 'hex').toString('utf8');
};