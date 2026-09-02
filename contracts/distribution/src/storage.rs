//! Acceso a storage del contrato de distribución.
//!
//! Las listas de participantes viven como entradas indexadas
//! (`XxxAt(epoch, i)` + `XxxCount(epoch)`) en vez de un `Vec` en una sola
//! entrada: así una página del reparto lee sólo las cuentas que va a acreditar
//! y no el padrón completo, que es lo que hacía inviable el `distribute()` de
//! Cairo bajo los límites de recursos de Soroban.

use soroban_sdk::{Address, Env};

use crate::types::{DataKey, Error, Party, Run};

/// Un ledger cada ~5 s.
const DAY_IN_LEDGERS: u32 = 17_280;

/// Extender a 150 días. Mainnet permite hasta `max_entry_ttl = 3_110_400`
/// (~180 días); 150 deja margen ante un cambio de parámetros de red.
const BUMP: u32 = 150 * DAY_IN_LEDGERS;
/// Extender recién cuando quedan menos de 30 días. Una entrada nueva ya nace
/// con `min_persistent_ttl = 2_073_600` (~120 días), así que con un umbral más
/// alto se pagaría renta en cada escritura sin necesidad.
const THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;

pub fn extend_instance(env: &Env) {
    env.storage().instance().extend_ttl(THRESHOLD, BUMP);
}

fn bump(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, THRESHOLD, BUMP);
}

fn get_i128(env: &Env, key: DataKey) -> i128 {
    env.storage().persistent().get(&key).unwrap_or(0)
}

fn set_i128(env: &Env, key: DataKey, value: i128) {
    env.storage().persistent().set(&key, &value);
    bump(env, &key);
}

fn get_u32(env: &Env, key: DataKey) -> u32 {
    env.storage().persistent().get(&key).unwrap_or(0)
}

fn set_u32(env: &Env, key: DataKey, value: u32) {
    env.storage().persistent().set(&key, &value);
    bump(env, &key);
}

// ── configuración ─────────────────────────────────────────────────────────

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

pub fn set_marketplace(env: &Env, marketplace: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::Marketplace, marketplace);
}

pub fn get_marketplace(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Marketplace)
        .ok_or(Error::NotInitialized)
}

pub fn epoch(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::Epoch).unwrap_or(0)
}

pub fn set_epoch(env: &Env, value: u32) {
    env.storage().instance().set(&DataKey::Epoch, &value);
}

pub fn get_run(env: &Env) -> Option<Run> {
    env.storage().instance().get(&DataKey::Run)
}

pub fn set_run(env: &Env, run: &Run) {
    env.storage().instance().set(&DataKey::Run, run);
}

pub fn clear_run(env: &Env) {
    env.storage().instance().remove(&DataKey::Run);
}

// ── totales por epoch ─────────────────────────────────────────────────────

pub fn total_purchases(env: &Env, epoch: u32) -> i128 {
    get_i128(env, DataKey::TotalPurchases(epoch))
}

pub fn add_total_purchases(env: &Env, epoch: u32, delta: i128) {
    let current = total_purchases(env, epoch);
    set_i128(env, DataKey::TotalPurchases(epoch), current + delta);
}

pub fn total_profit(env: &Env, epoch: u32) -> i128 {
    get_i128(env, DataKey::TotalProfit(epoch))
}

pub fn add_total_profit(env: &Env, epoch: u32, delta: i128) {
    let current = total_profit(env, epoch);
    set_i128(env, DataKey::TotalProfit(epoch), current + delta);
}

pub fn clear_totals(env: &Env, epoch: u32) {
    env.storage()
        .persistent()
        .remove(&DataKey::TotalPurchases(epoch));
    env.storage()
        .persistent()
        .remove(&DataKey::TotalProfit(epoch));
}

// ── padrones paginados ────────────────────────────────────────────────────

fn count_key(party: Party, epoch: u32) -> DataKey {
    match party {
        Party::CoffeeLover => DataKey::ClCount(epoch),
        Party::Producer => DataKey::ProducerCount(epoch),
        Party::Roaster => DataKey::RoasterCount(epoch),
    }
}

fn at_key(party: Party, epoch: u32, index: u32) -> DataKey {
    match party {
        Party::CoffeeLover => DataKey::ClAt(epoch, index),
        Party::Producer => DataKey::ProducerAt(epoch, index),
        Party::Roaster => DataKey::RoasterAt(epoch, index),
    }
}

fn purchase_key(party: Party, epoch: u32, address: &Address) -> DataKey {
    match party {
        Party::CoffeeLover => DataKey::PurchasePerCl(epoch, address.clone()),
        Party::Producer => DataKey::PurchasePerProducer(epoch, address.clone()),
        Party::Roaster => DataKey::PurchasePerRoaster(epoch, address.clone()),
    }
}

pub fn party_count(env: &Env, party: Party, epoch: u32) -> u32 {
    get_u32(env, count_key(party, epoch))
}

pub fn party_at(env: &Env, party: Party, epoch: u32, index: u32) -> Option<Address> {
    env.storage().persistent().get(&at_key(party, epoch, index))
}

pub fn purchases_of(env: &Env, party: Party, epoch: u32, address: &Address) -> i128 {
    get_i128(env, purchase_key(party, epoch, address))
}

/// Acumula la compra y da de alta la cuenta en el padrón la primera vez.
pub fn add_purchase(env: &Env, party: Party, epoch: u32, address: &Address, amount: i128) {
    let current = purchases_of(env, party, epoch, address);
    if current == 0 {
        let count = party_count(env, party, epoch);
        let key = at_key(party, epoch, count);
        env.storage().persistent().set(&key, address);
        bump(env, &key);
        set_u32(env, count_key(party, epoch), count + 1);
    }
    set_i128(env, purchase_key(party, epoch, address), current + amount);
}

/// Borra las entradas de una cuenta ya acreditada. El epoch queda cerrado.
pub fn clear_party_entry(env: &Env, party: Party, epoch: u32, index: u32, address: &Address) {
    env.storage()
        .persistent()
        .remove(&at_key(party, epoch, index));
    env.storage()
        .persistent()
        .remove(&purchase_key(party, epoch, address));
}

pub fn clear_party_count(env: &Env, party: Party, epoch: u32) {
    env.storage().persistent().remove(&count_key(party, epoch));
}

// ── cofundadores (fuera de epoch: el padrón persiste entre repartos) ───────

pub fn cofounder_count(env: &Env) -> u32 {
    get_u32(env, DataKey::CofounderCount)
}

pub fn cofounder_at(env: &Env, index: u32) -> Option<Address> {
    env.storage().persistent().get(&DataKey::CofounderAt(index))
}

pub fn push_cofounder(env: &Env, address: &Address) {
    let count = cofounder_count(env);
    let key = DataKey::CofounderAt(count);
    env.storage().persistent().set(&key, address);
    bump(env, &key);
    set_u32(env, DataKey::CofounderCount, count + 1);
}

pub fn has_cofounder(env: &Env, address: &Address) -> bool {
    let count = cofounder_count(env);
    for i in 0..count {
        if cofounder_at(env, i).as_ref() == Some(address) {
            return true;
        }
    }
    false
}

// ── saldos reclamables ────────────────────────────────────────────────────

pub fn cl_balance(env: &Env, address: &Address) -> i128 {
    get_i128(env, DataKey::ClBalance(address.clone()))
}

pub fn set_cl_balance(env: &Env, address: &Address, value: i128) {
    set_i128(env, DataKey::ClBalance(address.clone()), value);
}

pub fn producer_balance(env: &Env, address: &Address) -> i128 {
    get_i128(env, DataKey::ProducerBalance(address.clone()))
}

pub fn set_producer_balance(env: &Env, address: &Address, value: i128) {
    set_i128(env, DataKey::ProducerBalance(address.clone()), value);
}

pub fn roaster_balance(env: &Env, address: &Address) -> i128 {
    get_i128(env, DataKey::RoasterBalance(address.clone()))
}

pub fn set_roaster_balance(env: &Env, address: &Address, value: i128) {
    set_i128(env, DataKey::RoasterBalance(address.clone()), value);
}

pub fn cambiatus_balance(env: &Env) -> i128 {
    get_i128(env, DataKey::CambiatusBalance)
}

pub fn set_cambiatus_balance(env: &Env, value: i128) {
    set_i128(env, DataKey::CambiatusBalance, value);
}

pub fn cofiblocks_balance(env: &Env) -> i128 {
    get_i128(env, DataKey::CofiblocksBalance)
}

pub fn set_cofiblocks_balance(env: &Env, value: i128) {
    set_i128(env, DataKey::CofiblocksBalance, value);
}

pub fn cofounder_balance(env: &Env, address: &Address) -> i128 {
    get_i128(env, DataKey::CofounderBalance(address.clone()))
}

pub fn set_cofounder_balance(env: &Env, address: &Address, value: i128) {
    set_i128(env, DataKey::CofounderBalance(address.clone()), value);
}

/// Acredita según el padrón que corresponda.
pub fn add_party_balance(env: &Env, party: Party, address: &Address, delta: i128) {
    match party {
        Party::CoffeeLover => set_cl_balance(env, address, cl_balance(env, address) + delta),
        Party::Producer => {
            set_producer_balance(env, address, producer_balance(env, address) + delta)
        }
        Party::Roaster => set_roaster_balance(env, address, roaster_balance(env, address) + delta),
    }
}
