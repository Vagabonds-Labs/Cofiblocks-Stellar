import { ROLES } from './contracts';

/** topics: `["create_product", token_id]` */
export interface CreateProductEvent {
	token_id: string;
	initial_stock: string;
	owner: string;
	/** Precio con el fee de mercado incluido: es el que persiste `Product.price`. */
	price: string;
}

/** topics: `["buy_product", token_id]` */
export interface BuyProductEvent {
	token_id: string;
	amount: string;
	buyer: string;
}

/** topics: `["update_stock", token_id]` */
export interface UpdateStockEvent {
	token_id: string;
	new_stock: string;
}

/** topics: `["payment_seller", seller]` */
export interface PaymentSellerEvent {
	token_ids: string[];
	seller: string;
	payment: string;
}

/**
 * topics: `["buy_batch", buyer]`
 *
 * Lleva `total_paid` y `delivery_fee` explícitos, así verificar el pago del
 * envío no depende de sumar los `transfer` del SAC de USDC.
 */
export interface BuyBatchEvent {
	buyer: string;
	token_ids: string[];
	amounts: string[];
	total_paid: string;
	delivery_fee: string;
}

/** topics: `["assign_role", role]` */
export interface AssignRoleEvent {
	role: string;
	account: string;
}

/** topics: `["delete_product", token_id]` */
export interface DeleteProductEvent {
	token_id: string;
}

export interface CreateProductEvents {
	createProduct: CreateProductEvent | null;
}

export interface CheckoutEvents {
	buyProduct: BuyProductEvent[] | null;
	paymentSeller: PaymentSellerEvent[] | null;
	updateStock: UpdateStockEvent[] | null;
	buyBatch: BuyBatchEvent | null;
}

/** Evento crudo, para las rutas que devuelven todo sin interpretar. */
export interface RawEvent {
	contractId: string;
	name: string;
	topics: unknown[];
	data: Record<string, unknown> | unknown;
}

export type MarketplaceEvents =
	| CreateProductEvents
	| AssignRoleEvent
	| CheckoutEvents
	| RawEvent[];

export type MarketplaceEventType = 'CREATE_PRODUCT' | 'ASSIGN_ROLE' | 'REVOKE_ROLE' | 'CHECKOUT';

export { ROLES };
