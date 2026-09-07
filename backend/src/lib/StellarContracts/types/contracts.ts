export enum StellarContract {
	MARKETPLACE = "Marketplace",
	DISTRIBUTION = "Distribution",
	USDC = "USDC",
}

/**
 * Roles del marketplace. El orden es el que serializa el contrato: el CLI y el
 * SDK los mandan como enteros.
 */
export enum ROLES {
	PRODUCER = "PRODUCER",
	ROASTER = "ROASTER",
	CAMBIATUS = "CAMBIATUS",
	COFIBLOCKS = "COFIBLOCKS",
	COFOUNDER = "COFOUNDER",
	CONSUMER = "CONSUMER",
}

export const ROLE_DISCRIMINANTS: Record<ROLES, number> = {
	[ROLES.PRODUCER]: 0,
	[ROLES.ROASTER]: 1,
	[ROLES.CAMBIATUS]: 2,
	[ROLES.COFIBLOCKS]: 3,
	[ROLES.COFOUNDER]: 4,
	[ROLES.CONSUMER]: 5,
};

/** Producto tal como lo devuelve `get_product`, ya convertido a tipos de JS. */
export interface ListedProduct {
	token_id: string;
	stock: number;
	sells: number;
	price_usdc: string;
	price_usdc_with_fee: string;
	is_producer: boolean;
	owner: string;
	associated_producer: string | null;
	short_description: string;
	is_available: boolean;
}
