use soroban_sdk::{contracterror, contracttype, Address, String};

pub use cofiblocks_interfaces::Role;

/// Producto listado en el marketplace.
///
/// El stock vive acá y sólo acá: no hay NFT paralelo que lo represente.
/// `token_id` se conserva como identificador on-chain porque es lo que guarda
/// la columna `Product.tokenId` en Postgres y lo que consumen las rutas.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ListedProduct {
    pub token_id: u128,
    pub stock: u32,
    pub sells: u32,
    /// Precio que cobra el vendedor, en unidades mínimas de USDC (7 decimales).
    pub price_usdc: i128,
    /// Precio que paga el comprador: `price_usdc` más el fee de mercado.
    pub price_usdc_with_fee: i128,
    pub is_producer: bool,
    pub owner: Address,
    /// Productor asociado cuando el vendedor es tostador. `None` equivale a la
    /// dirección cero del contrato Cairo.
    pub associated_producer: Option<Address>,
    pub short_description: String,
    pub is_available: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Usdc,
    Distribution,
    /// Fee de mercado en basis points (5 000 bps = 50 %).
    MarketFee,
    NextTokenId,
    Product(u128),
    SellerBalance(Address),
    HasRole(Role, Address),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// El caller no tiene el rol que la operación exige.
    Unauthorized = 3,
    /// El caller no es PRODUCER ni ROASTER.
    CallerIsNotASeller = 4,
    ProductNotFound = 5,
    ProductNotAvailable = 6,
    NotYourProduct = 7,
    NotEnoughStock = 8,
    /// `initial_stock`/`amount` fuera de (0, 1000].
    InvalidStock = 9,
    InvalidPrice = 10,
    InvalidAmount = 11,
    /// El fee configurado redondearía a cero para este precio.
    FeeTooLow = 12,
    /// `token_ids` y `amounts` tienen largos distintos, o la compra viene vacía.
    InvalidPurchase = 13,
    /// La compra excede el máximo de ítems que entra en el presupuesto de recursos.
    TooManyItems = 14,
    NoTokensToClaim = 15,
    ContractInsufficientBalance = 16,
}
