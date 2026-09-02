#![no_std]
//! Tipos e interfaces compartidas entre `marketplace` y `distribution`.
//!
//! Vive en un crate aparte para que el marketplace pueda invocar al contrato de
//! distribución sin arrastrar su implementación dentro de su propio WASM.

use soroban_sdk::{contractclient, contracterror, contracttype, Address, Env};

/// Roles del marketplace. Misma semántica que el enum `ROLES` de Cairo.
///
/// El orden importa: es el que usa el backend al serializar el rol.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Role {
    Producer = 0,
    Roaster = 1,
    Cambiatus = 2,
    Cofiblocks = 3,
    Cofounder = 4,
    Consumer = 5,
}

/// Fase del reparto paginado.
///
/// `distribute` avanza de fase automáticamente cuando agota la lista de la fase
/// actual. El backend no necesita conocer el orden: sólo repetir la llamada con
/// el cursor que le devuelve el contrato hasta recibir `done == true`.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Phase {
    CoffeeLovers = 0,
    Producers = 1,
    Roasters = 2,
    Fixed = 3,
    Cofounders = 4,
}

/// Lo que devuelve cada página de `distribute`.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct DistributeProgress {
    /// Fase en la que quedó el reparto tras esta página.
    pub phase: Phase,
    /// Cursor con el que hay que llamar a la próxima página.
    pub next_cursor: u32,
    /// Cantidad de cuentas acreditadas en esta página.
    pub processed: u32,
    /// `true` cuando el reparto terminó y no hay que llamar más.
    pub done: bool,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum DistributionError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    /// El `cursor` recibido no es el que el contrato espera. Protege contra
    /// saltarse cuentas o pagarles dos veces.
    InvalidCursor = 4,
    /// No hay nada que repartir: `total_profit` es cero.
    NothingToDistribute = 5,
    InvalidAmount = 6,
}

/// Interfaz del contrato de distribución tal como la consume el marketplace.
#[contractclient(name = "DistributionClient")]
pub trait DistributionTrait {
    /// Registra una compra. Sólo la invoca el marketplace.
    fn register_purchase(
        env: Env,
        buyer: Address,
        product_owner: Address,
        is_producer: bool,
        producer: Option<Address>,
        product_price: i128,
        profit: i128,
    ) -> Result<(), DistributionError>;

    fn coffee_lover_claim_balance(env: Env, address: Address) -> i128;
    fn coffee_lover_claim_reset(env: Env, address: Address) -> Result<(), DistributionError>;
    fn producer_claim_balance(env: Env, address: Address) -> i128;
    fn producer_claim_reset(env: Env, address: Address) -> Result<(), DistributionError>;
    fn roaster_claim_balance(env: Env, address: Address) -> i128;
    fn roaster_claim_reset(env: Env, address: Address) -> Result<(), DistributionError>;
    fn cambiatus_claim_balance(env: Env) -> i128;
    fn cambiatus_claim_reset(env: Env) -> Result<(), DistributionError>;
    fn cofiblocks_claim_balance(env: Env) -> i128;
    fn cofiblocks_claim_reset(env: Env) -> Result<(), DistributionError>;
    fn cofounder_claim_balance(env: Env, address: Address) -> i128;
    fn cofounder_claim_reset(env: Env, address: Address) -> Result<(), DistributionError>;

    fn get_total_purchases(env: Env) -> i128;
    fn get_total_profit(env: Env) -> i128;
}
