#![no_std]
//! Marketplace de café tokenizado de CofiBlocks.
//!
//! Diferencias estructurales respecto de la versión Cairo:
//!
//! * **No hay NFT de producto.** El stock es un contador en storage; no existe
//!   colección ERC-1155 ni `ERC1155Receiver`. `token_id` se conserva sólo como
//!   identificador on-chain del producto.
//! * **Una sola invocación por transacción.** Stellar admite un único
//!   `InvokeHostFunction` por transacción, así que el multicall del checkout
//!   (`approve` + N × `buy_product` + `transfer` del envío) colapsa en
//!   [`Marketplace::buy_products`].
//! * **No hay `approve`.** La autorización viaja por el árbol de invocación.
//! * **Montos en `i128`** con 7 decimales (USDC en Stellar es un activo clásico).

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use cofiblocks_interfaces::DistributionClient;
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Vec};

pub use crate::types::{DataKey, Error, ListedProduct, Role};

/// Tope de ítems por compra.
///
/// Existe porque `buy_products` hace una lectura de storage, una escritura y una
/// invocación a `distribution` por ítem, y Soroban corta por presupuesto de CPU,
/// memoria, footprint y tamaño de eventos.
///
/// El valor sale de medir (ver `test::el_costo_de_la_compra_crece_linealmente_
/// con_los_items`): la compra suma ~544 B de eventos, 1 entrada escrita y 2 de
/// footprint por ítem. Contra los 16 KB de eventos por transacción de mainnet el
/// techo teórico ronda los 28 ítems, pero 16 es el mayor tamaño que pasa el
/// presupuesto que enforcea el entorno de test, así que se queda ahí.
///
/// **Pendiente de fase 2:** confirmarlo por simulación contra testnet con el
/// WASM desplegado, que es la única medición que incluye el costo de la VM.
/// El carrito del frontend replica este límite.
pub const MAX_ITEMS_PER_PURCHASE: u32 = 16;

/// Stock máximo por producto y por incremento. Igual que el contrato Cairo.
pub const MAX_STOCK: u32 = 1_000;

const BPS_DENOMINATOR: i128 = 10_000;

#[contract]
pub struct Marketplace;

#[contractimpl]
impl Marketplace {
    /// # Argumentos
    /// * `distribution` — contrato de reparto de utilidades.
    /// * `usdc` — SAC de USDC (7 decimales).
    /// * `admin` — cuenta con permisos de administración.
    /// * `market_fee` — fee de mercado en basis points (5 000 bps = 50 %).
    pub fn __constructor(
        env: Env,
        distribution: Address,
        usdc: Address,
        admin: Address,
        market_fee: u32,
    ) -> Result<(), Error> {
        if storage::is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        storage::set_admin(&env, &admin);
        storage::set_usdc(&env, &usdc);
        storage::set_distribution(&env, &distribution);
        storage::set_market_fee(&env, market_fee);
        storage::extend_instance(&env);
        Ok(())
    }

    // ── roles ─────────────────────────────────────────────────────────────

    pub fn assign_role(env: Env, role: Role, assignee: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        storage::grant_role(&env, role, &assignee);
        events::AssignRole {
            role,
            assignee: assignee.clone(),
        }
        .publish(&env);
        Ok(())
    }

    pub fn account_has_role(env: Env, role: Role, account: Address) -> bool {
        storage::has_role(&env, role, &account)
    }

    pub fn account_revoke_role(env: Env, role: Role, revokee: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        storage::revoke_role(&env, role, &revokee);
        events::RevokeRole {
            role,
            revokee: revokee.clone(),
        }
        .publish(&env);
        Ok(())
    }

    // ── productos ─────────────────────────────────────────────────────────

    /// Registra un producto con su stock inicial. **No mintea nada.**
    pub fn create_product(
        env: Env,
        seller: Address,
        initial_stock: u32,
        price: i128,
        associated_producer: Option<Address>,
        short_description: String,
    ) -> Result<u128, Error> {
        seller.require_auth();
        storage::extend_instance(&env);

        let is_producer = Self::seller_is_producer(&env, &seller)?;
        if initial_stock == 0 || initial_stock > MAX_STOCK {
            return Err(Error::InvalidStock);
        }
        if price <= 0 {
            return Err(Error::InvalidPrice);
        }

        let market_fee = storage::get_market_fee(&env)?;
        let price_with_fee = price + Self::calculate_fee(price, market_fee)?;
        let token_id = storage::next_token_id(&env);

        let product = ListedProduct {
            token_id,
            stock: initial_stock,
            sells: 0,
            price_usdc: price,
            price_usdc_with_fee: price_with_fee,
            is_producer,
            owner: seller.clone(),
            associated_producer,
            short_description,
            is_available: true,
        };
        storage::set_product(&env, &product);
        events::CreateProduct {
            token_id,
            initial_stock,
            owner: seller.clone(),
            price: price_with_fee,
        }
        .publish(&env);
        Ok(token_id)
    }

    /// Incrementa el contador de stock. Sin mint.
    pub fn add_stock(env: Env, seller: Address, token_id: u128, amount: u32) -> Result<(), Error> {
        seller.require_auth();
        storage::extend_instance(&env);

        let mut product = storage::get_product(&env, token_id)?;
        if product.owner != seller {
            return Err(Error::NotYourProduct);
        }
        if amount == 0 || amount > MAX_STOCK {
            return Err(Error::InvalidStock);
        }
        if !product.is_available {
            return Err(Error::ProductNotAvailable);
        }

        product.stock += amount;
        let new_stock = product.stock;
        storage::set_product(&env, &product);
        events::UpdateStock {
            token_id,
            new_stock,
        }
        .publish(&env);
        Ok(())
    }

    /// Deslista el producto. No quema nada: lo marca no disponible y stock 0.
    pub fn delete_product(env: Env, seller: Address, token_id: u128) -> Result<(), Error> {
        seller.require_auth();
        storage::extend_instance(&env);

        Self::seller_is_producer(&env, &seller)?;
        let mut product = storage::get_product(&env, token_id)?;
        if product.owner != seller {
            return Err(Error::NotYourProduct);
        }

        product.is_available = false;
        product.stock = 0;
        storage::set_product(&env, &product);
        events::DeleteProduct { token_id }.publish(&env);
        Ok(())
    }

    pub fn get_product(env: Env, token_id: u128) -> Result<ListedProduct, Error> {
        storage::get_product(&env, token_id)
    }

    /// Extiende el TTL de un producto sin modificarlo.
    ///
    /// Sirve para que el panel admin evite que un producto inactivo se archive.
    /// No exige autorización: sólo prolonga la vida de una entrada existente.
    pub fn touch_product(env: Env, token_id: u128) -> Result<(), Error> {
        storage::extend_instance(&env);
        storage::get_product(&env, token_id).map(|_| ())
    }

    // ── compra ────────────────────────────────────────────────────────────

    /// Compra en lote: cobra el total en USDC (productos + envío), acredita
    /// saldo a cada vendedor, asigna el rol CONSUMER al comprador, registra la
    /// compra en `distribution` y descuenta stock.
    ///
    /// Reemplaza al multicall `approve` + N × `buy_product` + `transfer` del fee
    /// de envío, que en Stellar no es posible: una transacción admite un único
    /// `InvokeHostFunction`.
    ///
    /// `token_ids` no admite repetidos: el backend arma la lista desde
    /// `orderItems`, que ya es única por producto.
    pub fn buy_products(
        env: Env,
        buyer: Address,
        token_ids: Vec<u128>,
        amounts: Vec<u32>,
        delivery_fee: i128,
    ) -> Result<(), Error> {
        buyer.require_auth();
        storage::extend_instance(&env);

        let n = token_ids.len();
        if n == 0 || n != amounts.len() {
            return Err(Error::InvalidPurchase);
        }
        if n > MAX_ITEMS_PER_PURCHASE {
            return Err(Error::TooManyItems);
        }
        if delivery_fee < 0 {
            return Err(Error::InvalidAmount);
        }

        // 1. Validar todo y calcular el total antes de mover un solo token.
        let mut total: i128 = delivery_fee;
        for i in 0..n {
            let token_id = token_ids.get_unchecked(i);
            let amount = amounts.get_unchecked(i);
            if amount == 0 {
                return Err(Error::InvalidAmount);
            }
            for j in 0..i {
                if token_ids.get_unchecked(j) == token_id {
                    return Err(Error::InvalidPurchase);
                }
            }
            let product = storage::get_product(&env, token_id)?;
            if !product.is_available {
                return Err(Error::ProductNotAvailable);
            }
            if product.stock < amount {
                return Err(Error::NotEnoughStock);
            }
            total += product.price_usdc_with_fee * amount as i128;
        }

        // 2. Un solo cobro. Sin `approve` y sin `transfer_from`: el
        //    `require_auth` del comprador ya quedó cubierto por la firma.
        let usdc = token::TokenClient::new(&env, &storage::get_usdc(&env)?);
        let market = env.current_contract_address();
        usdc.transfer(&buyer, &market, &total);

        // 3. Acreditar, descontar stock y registrar el reparto.
        let distribution = DistributionClient::new(&env, &storage::get_distribution(&env)?);
        for i in 0..n {
            let token_id = token_ids.get_unchecked(i);
            let amount = amounts.get_unchecked(i);
            let mut product = storage::get_product(&env, token_id)?;

            let amount_i128 = amount as i128;
            let producer_fee = product.price_usdc * amount_i128;
            let profit = (product.price_usdc_with_fee - product.price_usdc) * amount_i128;

            events::BuyProduct {
                token_id,
                amount,
                buyer: buyer.clone(),
            }
            .publish(&env);

            let balance = storage::get_seller_balance(&env, &product.owner);
            storage::set_seller_balance(&env, &product.owner, balance + producer_fee);
            events::PaymentSeller {
                seller: product.owner.clone(),
                token_id,
                payment: producer_fee,
            }
            .publish(&env);

            product.stock -= amount;
            product.sells += amount;
            let new_stock = product.stock;

            distribution.register_purchase(
                &buyer,
                &product.owner,
                &product.is_producer,
                &product.associated_producer,
                &producer_fee,
                &profit,
            );

            storage::set_product(&env, &product);
            events::UpdateStock {
                token_id,
                new_stock,
            }
            .publish(&env);
        }

        // El rol CONSUMER habilita al coffee lover a reclamar su parte del
        // reparto en `withdraw_distribution_balance`.
        if !storage::has_role(&env, Role::Consumer, &buyer) {
            storage::grant_role(&env, Role::Consumer, &buyer);
            events::AssignRole {
                role: Role::Consumer,
                assignee: buyer.clone(),
            }
            .publish(&env);
        }

        events::BuyBatch {
            buyer: buyer.clone(),
            token_ids,
            amounts,
            total_paid: total,
            delivery_fee,
        }
        .publish(&env);
        Ok(())
    }

    // ── saldos ────────────────────────────────────────────────────────────

    pub fn get_seller_balance(env: Env, wallet_address: Address) -> i128 {
        storage::get_seller_balance(&env, &wallet_address)
    }

    /// Productores y tostadores cobran sus ventas por acá.
    pub fn withdraw_seller_balance(env: Env, seller: Address) -> Result<(), Error> {
        seller.require_auth();
        storage::extend_instance(&env);

        let balance = storage::get_seller_balance(&env, &seller);
        Self::withdraw_usdc(&env, balance, &seller)?;
        storage::set_seller_balance(&env, &seller, 0);
        events::SellerWithdraw {
            seller: seller.clone(),
            amount: balance,
        }
        .publish(&env);
        Ok(())
    }

    /// Cada rol reclama por acá su parte del reparto de utilidades.
    pub fn withdraw_distribution_balance(
        env: Env,
        caller: Address,
        role: Role,
    ) -> Result<(), Error> {
        caller.require_auth();
        storage::extend_instance(&env);

        if !storage::has_role(&env, role, &caller) {
            return Err(Error::Unauthorized);
        }

        let distribution = DistributionClient::new(&env, &storage::get_distribution(&env)?);
        let balance = match role {
            Role::Consumer => distribution.coffee_lover_claim_balance(&caller),
            Role::Producer => distribution.producer_claim_balance(&caller),
            Role::Roaster => distribution.roaster_claim_balance(&caller),
            Role::Cambiatus => distribution.cambiatus_claim_balance(),
            Role::Cofiblocks => distribution.cofiblocks_claim_balance(),
            Role::Cofounder => distribution.cofounder_claim_balance(&caller),
        };

        Self::withdraw_usdc(&env, balance, &caller)?;

        match role {
            Role::Consumer => distribution.coffee_lover_claim_reset(&caller),
            Role::Producer => distribution.producer_claim_reset(&caller),
            Role::Roaster => distribution.roaster_claim_reset(&caller),
            Role::Cambiatus => distribution.cambiatus_claim_reset(),
            Role::Cofiblocks => distribution.cofiblocks_claim_reset(),
            Role::Cofounder => distribution.cofounder_claim_reset(&caller),
        }

        events::DistributionWithdraw {
            recipient: caller.clone(),
            role,
            amount: balance,
        }
        .publish(&env);
        Ok(())
    }

    /// Retiro administrativo del USDC que quede en el contrato.
    pub fn withdraw(env: Env, amount: i128, recipient: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        Self::withdraw_usdc(&env, amount, &recipient)
    }

    // ── administración ────────────────────────────────────────────────────

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        storage::get_admin(&env)
    }

    pub fn get_usdc(env: Env) -> Result<Address, Error> {
        storage::get_usdc(&env)
    }

    pub fn get_distribution(env: Env) -> Result<Address, Error> {
        storage::get_distribution(&env)
    }

    pub fn get_market_fee(env: Env) -> Result<u32, Error> {
        storage::get_market_fee(&env)
    }

    pub fn get_next_token_id(env: Env) -> u128 {
        storage::peek_token_id(&env)
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        Self::require_admin(&env)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // ── internos ──────────────────────────────────────────────────────────

    fn require_admin(env: &Env) -> Result<(), Error> {
        storage::get_admin(env)?.require_auth();
        storage::extend_instance(env);
        Ok(())
    }

    /// Exige que el caller sea PRODUCER o ROASTER; devuelve si es productor.
    fn seller_is_producer(env: &Env, caller: &Address) -> Result<bool, Error> {
        let is_producer = storage::has_role(env, Role::Producer, caller);
        let is_roaster = storage::has_role(env, Role::Roaster, caller);
        if !is_producer && !is_roaster {
            return Err(Error::CallerIsNotASeller);
        }
        Ok(is_producer)
    }

    fn withdraw_usdc(env: &Env, amount: i128, recipient: &Address) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::NoTokensToClaim);
        }
        let usdc = token::TokenClient::new(env, &storage::get_usdc(env)?);
        let contract = env.current_contract_address();
        if usdc.balance(&contract) < amount {
            return Err(Error::ContractInsufficientBalance);
        }
        usdc.transfer(&contract, recipient, &amount);
        Ok(())
    }

    /// `bps` es el porcentaje en basis points (2,5 % = 250 bps).
    ///
    /// Conserva la guarda del contrato Cairo: si `amount * bps` no llega a
    /// 10 000 el fee redondearía a cero, y eso se rechaza.
    fn calculate_fee(amount: i128, bps: u32) -> Result<i128, Error> {
        let numerator = amount * bps as i128;
        if numerator < BPS_DENOMINATOR {
            return Err(Error::FeeTooLow);
        }
        Ok(numerator / BPS_DENOMINATOR)
    }
}
