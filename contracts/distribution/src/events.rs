//! Eventos del contrato de distribución.

use soroban_sdk::{contractevent, Address};

/// topics: `["add_cofounder"]`
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct AddCofounder {
    pub address: Address,
}

/// topics: `["distribute_done", epoch]`
///
/// Se emite en la última página del reparto, con los totales del epoch cerrado.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct DistributeDone {
    #[topic]
    pub epoch: u32,
    pub total_purchases: i128,
    pub total_profit: i128,
}
