import { Event } from "starknet";

export interface DeleteProductEvent {
	token_id: string,
}

// Emitted when a product is listed to the Marketplace
export interface CreateProductEvent {
	token_id: string,
	initial_stock: string,
	owner: string,
	price: string,
}

// Emitted when the stock of a product is updated
export interface UpdateStockEvent {
	token_id: string,
	new_stock: string,
}

// Emitted when a product is bought from the Marketplace
export interface BuyProductEvent {
	token_id: string,
	amount: string,
	buyer: string,
}

// Emitted when a batch of products is bought from the Marketplace
export interface BuyBatchProductsEvent {
	token_ids: string[],
	token_amount: string[],
	buyer: string,
}

// Emitted when the seller gets their tokens from a sell
export interface PaymentSellerEvent {
	token_ids: string[],
	seller: string,
	payment: string,
}

export interface CreateProductEvents {
	createProduct: CreateProductEvent | null
}

export interface AssignRoleEvent {
	role: string,
	account: string,
}

// CHECKOUT EVENTS

export const BUY_PRODUCT_EVENT_SELECTOR = "0x1b7e285cf2f3aa8748905c3954eda5ccf3ce71e078ea320bb8f2602209c236a";
export const PAYMENT_SELLER_EVENT_SELECTOR = "0x14a6a6994becc3d34a49d89601aec77a0aa6e675db0a5a9671577b78b07e4b1";
export const UPDATE_STOCK_EVENT_SELECTOR = "0x2981d72831dca41dce0fd07e0431706fa90cb9e3fa622f43ec5738196ea6cdc";
export const MINT_EVENT_SELECTOR = "0x182d859c0807ba9db63baf8b9d9fdbfeb885d820be6e206b9dab626d995c433";
export const TRANSFER_EVENT_SELECTOR = "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";

export interface MintEvent {
	token_id: string,
	amount: string,
	from: string,
	to: string,
}

export interface CheckoutEvents {
	buyProduct: BuyProductEvent[] | null,
	paymentSeller: PaymentSellerEvent[] | null,
	updateStock: UpdateStockEvent[] | null,
	mint: MintEvent[] | null,
	transfer: TransferEvent[] | null,
}

export interface TransferEvent {
	from: string,
	to: string,
	amount: string,
	token: string,
}


export type MarketplaceEvents = CreateProductEvents | AssignRoleEvent | CheckoutEvents | Event[];
export type MarketplaceEventType =  'CREATE_PRODUCT' | 'ASSIGN_ROLE' | 'REVOKE_ROLE' | 'CHECKOUT';

export enum ROLES {
	PRODUCER = "PRODUCER",
	ROASTER = "ROASTER",
	CAMBIATUS = "CAMBIATUS",
	COFIBLOCKS = "COFIBLOCKS",
	COFOUNDER = "COFOUNDER",
	CONSUMER = "CONSUMER",
}

export const CREATE_PRODUCT_EVENT_SELECTOR = "0x3445cfe36cb1f05fc6459c6435ec98cafeb71c3d835b976a5e24260b1a82f3";
export const DELETE_PRODUCT_EVENT_SELECTOR = "0x0e44420769d0fd919a21a015e77b18efb7983734ce4a9005ad948e458e86af";


export const PRODUCER_ROLE_SELECTOR = "0x26228957b4ff1ee8d2f4555d58f130924b7939446a6af38afd42a510a51fbb4"
export const ROASTER_ROLE_SELECTOR = "0x02f91f2361748188bb0c1cf5266480adba22b03eac2e222c7173f50750b70312"
export const ASSIGN_ROLE_EVENT_SELECTOR = "0x9d4a59b844ac9d98627ddba326ab3707a7d7e105fd03c777569d0f61a91f1e"
