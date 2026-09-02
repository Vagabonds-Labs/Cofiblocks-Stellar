//! Eventos del marketplace.
//!
//! En Soroban los topics son símbolos legibles: se acabaron las constantes tipo
//! `BUY_PRODUCT_EVENT_SELECTOR = "0x1b7e28…"`. Con `#[contractevent]` la sección
//! de datos es un mapa indexado por nombre de campo, así que el backend recibe
//! objetos ya nombrados al hacer `getTransaction → resultMetaXdr → scValToNative`.

use soroban_sdk::{contractevent, Address, Vec};

use crate::types::Role;

/// topics: `["create_product", token_id]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct CreateProduct {
    #[topic]
    pub token_id: u128,
    pub initial_stock: u32,
    pub owner: Address,
    /// Precio con fee de mercado incluido: es el que persiste `Product.price`.
    pub price: i128,
}

/// topics: `["delete_product", token_id]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct DeleteProduct {
    #[topic]
    pub token_id: u128,
}

/// topics: `["update_stock", token_id]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct UpdateStock {
    #[topic]
    pub token_id: u128,
    pub new_stock: u32,
}

/// topics: `["buy_product", token_id]`
///
/// Es el evento que verifica `verifyBuyProductEvents` en el backend.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct BuyProduct {
    #[topic]
    pub token_id: u128,
    pub amount: u32,
    pub buyer: Address,
}

/// topics: `["payment_seller", seller]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct PaymentSeller {
    #[topic]
    pub seller: Address,
    pub token_id: u128,
    pub payment: i128,
}

/// topics: `["buy_batch", buyer]`
///
/// Resumen de la compra. Lleva `total_paid` y `delivery_fee` explícitos para que
/// `verifyDeliveryPayment` no tenga que sumar los eventos `transfer` del SAC de
/// USDC, que es lo que hacía en Starknet.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct BuyBatch {
    #[topic]
    pub buyer: Address,
    pub token_ids: Vec<u128>,
    pub amounts: Vec<u32>,
    pub total_paid: i128,
    pub delivery_fee: i128,
}

/// topics: `["assign_role", role]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct AssignRole {
    #[topic]
    pub role: Role,
    pub assignee: Address,
}

/// topics: `["revoke_role", role]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct RevokeRole {
    #[topic]
    pub role: Role,
    pub revokee: Address,
}

/// topics: `["seller_withdraw", seller]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct SellerWithdraw {
    #[topic]
    pub seller: Address,
    pub amount: i128,
}

/// topics: `["distribution_withdraw", recipient]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct DistributionWithdraw {
    #[topic]
    pub recipient: Address,
    pub role: Role,
    pub amount: i128,
}
