
export interface ListedProduct {
    token_id: bigint;
    stock: bigint;
    sells: bigint;
    price_usdc: bigint;
    price_usdc_with_fee: bigint;
    is_producer: boolean;
    owner: string;
    associated_producer: string;
    short_description: bigint;
    is_available: boolean;
}