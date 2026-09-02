//! Acceso a storage con extensión de TTL.
//!
//! Soroban archiva las entradas que nadie toca. Un producto que pasa meses sin
//! movimiento se archiva y la siguiente operación falla hasta que alguien lo
//! restaure — un modo de fallo que el contrato Cairo no tenía. Por eso **toda**
//! lectura y escritura pasa por acá y extiende el TTL.

use soroban_sdk::{Address, Env};

use crate::types::{DataKey, Error, ListedProduct, Role};

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

fn extend_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, THRESHOLD, BUMP);
}

// ── configuración (instance) ──────────────────────────────────────────────

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

pub fn set_usdc(env: &Env, usdc: &Address) {
    env.storage().instance().set(&DataKey::Usdc, usdc);
}

pub fn get_usdc(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Usdc)
        .ok_or(Error::NotInitialized)
}

pub fn set_distribution(env: &Env, distribution: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::Distribution, distribution);
}

pub fn get_distribution(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Distribution)
        .ok_or(Error::NotInitialized)
}

pub fn set_market_fee(env: &Env, bps: u32) {
    env.storage().instance().set(&DataKey::MarketFee, &bps);
}

pub fn get_market_fee(env: &Env) -> Result<u32, Error> {
    env.storage()
        .instance()
        .get(&DataKey::MarketFee)
        .ok_or(Error::NotInitialized)
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

/// Devuelve el `token_id` a usar y deja el siguiente listo.
pub fn next_token_id(env: &Env) -> u128 {
    let id: u128 = env
        .storage()
        .instance()
        .get(&DataKey::NextTokenId)
        .unwrap_or(1);
    env.storage()
        .instance()
        .set(&DataKey::NextTokenId, &(id + 1));
    id
}

pub fn peek_token_id(env: &Env) -> u128 {
    env.storage()
        .instance()
        .get(&DataKey::NextTokenId)
        .unwrap_or(1)
}

// ── productos (persistent) ────────────────────────────────────────────────

pub fn get_product(env: &Env, token_id: u128) -> Result<ListedProduct, Error> {
    let key = DataKey::Product(token_id);
    let product: ListedProduct = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::ProductNotFound)?;
    extend_persistent(env, &key);
    Ok(product)
}

pub fn set_product(env: &Env, product: &ListedProduct) {
    let key = DataKey::Product(product.token_id);
    env.storage().persistent().set(&key, product);
    extend_persistent(env, &key);
}

// ── saldos de vendedor (persistent) ───────────────────────────────────────

pub fn get_seller_balance(env: &Env, seller: &Address) -> i128 {
    let key = DataKey::SellerBalance(seller.clone());
    let balance = env.storage().persistent().get(&key).unwrap_or(0);
    if balance != 0 {
        extend_persistent(env, &key);
    }
    balance
}

pub fn set_seller_balance(env: &Env, seller: &Address, amount: i128) {
    let key = DataKey::SellerBalance(seller.clone());
    env.storage().persistent().set(&key, &amount);
    extend_persistent(env, &key);
}

// ── roles (persistent) ────────────────────────────────────────────────────

pub fn has_role(env: &Env, role: Role, account: &Address) -> bool {
    let key = DataKey::HasRole(role, account.clone());
    let granted: bool = env.storage().persistent().get(&key).unwrap_or(false);
    if granted {
        extend_persistent(env, &key);
    }
    granted
}

pub fn grant_role(env: &Env, role: Role, account: &Address) {
    let key = DataKey::HasRole(role, account.clone());
    env.storage().persistent().set(&key, &true);
    extend_persistent(env, &key);
}

pub fn revoke_role(env: &Env, role: Role, account: &Address) {
    let key = DataKey::HasRole(role, account.clone());
    env.storage().persistent().set(&key, &false);
    extend_persistent(env, &key);
}
