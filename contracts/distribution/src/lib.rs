#![no_std]
//! Reparto de utilidades de CofiBlocks.
//!
//! Los porcentajes son los mismos que en la versión Cairo. Lo que cambia es el
//! reparto: `distribute()` iteraba sobre listas sin cota de coffee lovers,
//! productores y tostadores, y Soroban corta por CPU, memoria y footprint.
//! Acá el reparto es paginado — ver [`Distribution::distribute`].

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use cofiblocks_interfaces::DistributionTrait;
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env};

pub use crate::types::{DataKey, DistributeProgress, Error, Party, Phase, Run};

/// Porcentajes de reparto. Suman 100.
const COFFEE_LOVER_PCT: i128 = 30;
const PRODUCER_PCT: i128 = 30;
const ROASTER_PCT: i128 = 5;
const CAMBIATUS_PCT: i128 = 2;
const COFIBLOCKS_PCT: i128 = 24;
const COFOUNDER_PCT: i128 = 9;

#[contract]
pub struct Distribution;

#[contractimpl]
impl Distribution {
    pub fn __constructor(env: Env, admin: Address) -> Result<(), Error> {
        if storage::is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        storage::set_admin(&env, &admin);
        storage::set_epoch(&env, 0);
        storage::extend_instance(&env);
        Ok(())
    }

    /// Autoriza al marketplace a registrar compras y resetear saldos.
    pub fn set_marketplace(env: Env, marketplace: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        storage::set_marketplace(&env, &marketplace);
        Ok(())
    }

    /// Da de alta un cofundador.
    ///
    /// **Cambio respecto de Cairo:** allá exigía `MARKETPLACE_ROLE`, pero el
    /// marketplace nunca la invocaba, así que era inalcanzable y el 9 % de los
    /// cofundadores se calculaba sobre una lista siempre vacía. Acá la llama el
    /// admin, que es lo que la función pretendía hacer.
    pub fn add_cofounder(env: Env, address: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        if !storage::has_cofounder(&env, &address) {
            storage::push_cofounder(&env, &address);
            events::AddCofounder { address }.publish(&env);
        }
        Ok(())
    }

    pub fn get_cofounder_count(env: Env) -> u32 {
        storage::cofounder_count(&env)
    }

    /// Reparte las utilidades de a páginas.
    ///
    /// La primera llamada (`cursor == 0`, sin reparto en curso) **congela** el
    /// epoch actual: las compras que entren a partir de ahí se acumulan en el
    /// epoch siguiente y no interfieren con el reparto en marcha.
    ///
    /// Hay que repetir la llamada pasando el `next_cursor` que devuelve, hasta
    /// recibir `done == true`. El contrato rechaza cualquier cursor distinto del
    /// que espera, para que no se saltee ni se pague dos veces a nadie.
    ///
    /// `limit` es la cantidad máxima de cuentas a acreditar en esta página.
    pub fn distribute(env: Env, cursor: u32, limit: u32) -> Result<DistributeProgress, Error> {
        Self::require_admin(&env)?;
        if limit == 0 {
            return Err(Error::InvalidAmount);
        }

        let mut run = match storage::get_run(&env) {
            Some(run) => {
                if cursor != run.cursor {
                    return Err(Error::InvalidCursor);
                }
                run
            }
            None => {
                if cursor != 0 {
                    return Err(Error::InvalidCursor);
                }
                let epoch = storage::epoch(&env);
                let total_profit = storage::total_profit(&env, epoch);
                if total_profit <= 0 {
                    return Err(Error::NothingToDistribute);
                }
                // A partir de acá las compras nuevas van al epoch siguiente.
                storage::set_epoch(&env, epoch + 1);
                Run {
                    epoch,
                    total_purchases: storage::total_purchases(&env, epoch),
                    total_profit,
                    phase: Phase::CoffeeLovers,
                    cursor: 0,
                }
            }
        };

        let mut processed_total: u32 = 0;
        let mut done = false;

        loop {
            let count = Self::phase_count(&env, &run);
            if run.cursor >= count {
                // Fase agotada (o vacía): pasar a la siguiente sin gastar página.
                if Self::advance_phase(&env, &mut run) {
                    done = true;
                    break;
                }
                continue;
            }
            if processed_total >= limit {
                break;
            }
            let budget = limit - processed_total;
            let n = Self::process_phase(&env, &run, budget);
            if n == 0 {
                break;
            }
            run.cursor += n;
            processed_total += n;
        }

        if done {
            storage::clear_totals(&env, run.epoch);
            storage::clear_run(&env);
            events::DistributeDone {
                epoch: run.epoch,
                total_purchases: run.total_purchases,
                total_profit: run.total_profit,
            }
            .publish(&env);
        } else {
            storage::set_run(&env, &run);
        }

        Ok(DistributeProgress {
            phase: run.phase,
            next_cursor: run.cursor,
            processed: processed_total,
            done,
        })
    }

    /// Reparto en curso, si lo hay. Lo usa el panel admin para retomar.
    pub fn get_run(env: Env) -> Option<Run> {
        storage::get_run(&env)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        storage::get_admin(&env)
    }

    pub fn get_marketplace(env: Env) -> Result<Address, Error> {
        storage::get_marketplace(&env)
    }

    pub fn get_epoch(env: Env) -> u32 {
        storage::epoch(&env)
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

    /// Sólo el marketplace registra compras y resetea saldos.
    ///
    /// Cuando el marketplace invoca a este contrato, su propia dirección queda
    /// autorizada por ser la invocadora directa; ninguna otra cuenta puede
    /// satisfacer este `require_auth`.
    fn require_marketplace(env: &Env) -> Result<(), Error> {
        storage::get_marketplace(env)?.require_auth();
        storage::extend_instance(env);
        Ok(())
    }

    fn phase_count(env: &Env, run: &Run) -> u32 {
        match run.phase {
            Phase::CoffeeLovers => storage::party_count(env, Party::CoffeeLover, run.epoch),
            Phase::Producers => storage::party_count(env, Party::Producer, run.epoch),
            Phase::Roasters => storage::party_count(env, Party::Roaster, run.epoch),
            // Cambiatus y CofiBlocks son montos fijos: una sola unidad de trabajo.
            Phase::Fixed => 1,
            Phase::Cofounders => storage::cofounder_count(env),
        }
    }

    /// Devuelve `true` cuando ya no queda fase siguiente.
    fn advance_phase(env: &Env, run: &mut Run) -> bool {
        let next = match run.phase {
            Phase::CoffeeLovers => {
                storage::clear_party_count(env, Party::CoffeeLover, run.epoch);
                Phase::Producers
            }
            Phase::Producers => {
                storage::clear_party_count(env, Party::Producer, run.epoch);
                Phase::Roasters
            }
            Phase::Roasters => {
                storage::clear_party_count(env, Party::Roaster, run.epoch);
                Phase::Fixed
            }
            Phase::Fixed => Phase::Cofounders,
            Phase::Cofounders => return true,
        };
        run.phase = next;
        run.cursor = 0;
        false
    }

    fn process_phase(env: &Env, run: &Run, budget: u32) -> u32 {
        match run.phase {
            Phase::CoffeeLovers => {
                Self::credit_party(env, run, Party::CoffeeLover, COFFEE_LOVER_PCT, budget)
            }
            Phase::Producers => Self::credit_party(env, run, Party::Producer, PRODUCER_PCT, budget),
            Phase::Roasters => Self::credit_party(env, run, Party::Roaster, ROASTER_PCT, budget),
            Phase::Fixed => {
                let cambiatus = percentage_of(run.total_profit, CAMBIATUS_PCT);
                storage::set_cambiatus_balance(env, storage::cambiatus_balance(env) + cambiatus);
                let cofiblocks = percentage_of(run.total_profit, COFIBLOCKS_PCT);
                storage::set_cofiblocks_balance(env, storage::cofiblocks_balance(env) + cofiblocks);
                1
            }
            Phase::Cofounders => Self::credit_cofounders(env, run, budget),
        }
    }

    /// Acredita a cada cuenta la parte proporcional a lo que compró/vendió.
    ///
    /// Misma aritmética entera que Cairo, truncamiento incluido, para que los
    /// montos coincidan exactamente con la implementación que reemplaza.
    fn credit_party(env: &Env, run: &Run, party: Party, pct: i128, budget: u32) -> u32 {
        let count = storage::party_count(env, party, run.epoch);
        let pool = percentage_of(run.total_profit, pct);
        let mut processed = 0u32;
        let mut index = run.cursor;

        while index < count && processed < budget {
            if let Some(address) = storage::party_at(env, party, run.epoch, index) {
                let purchases = storage::purchases_of(env, party, run.epoch, &address);
                let share_pct = if run.total_purchases > 0 {
                    purchases * 100 / run.total_purchases
                } else {
                    0
                };
                let balance = percentage_of(pool, share_pct);
                storage::add_party_balance(env, party, &address, balance);
                storage::clear_party_entry(env, party, run.epoch, index, &address);
            }
            index += 1;
            processed += 1;
        }
        processed
    }

    fn credit_cofounders(env: &Env, run: &Run, budget: u32) -> u32 {
        let count = storage::cofounder_count(env);
        if count == 0 {
            return 0;
        }
        let pool = percentage_of(run.total_profit, COFOUNDER_PCT);
        // División entera igual que Cairo: con 3 cofundadores cada uno cobra 33 %.
        let share_pct = 100i128 / count as i128;
        let mut processed = 0u32;
        let mut index = run.cursor;

        while index < count && processed < budget {
            if let Some(address) = storage::cofounder_at(env, index) {
                let balance = percentage_of(pool, share_pct);
                storage::set_cofounder_balance(
                    env,
                    &address,
                    storage::cofounder_balance(env, &address) + balance,
                );
            }
            index += 1;
            processed += 1;
        }
        processed
    }
}

#[contractimpl]
impl DistributionTrait for Distribution {
    fn register_purchase(
        env: Env,
        buyer: Address,
        product_owner: Address,
        is_producer: bool,
        producer: Option<Address>,
        product_price: i128,
        profit: i128,
    ) -> Result<(), Error> {
        Self::require_marketplace(&env)?;
        if product_price < 0 || profit < 0 {
            return Err(Error::InvalidAmount);
        }

        let epoch = storage::epoch(&env);
        let amount = product_price + profit;

        storage::add_purchase(&env, Party::CoffeeLover, epoch, &buyer, amount);

        if is_producer {
            storage::add_purchase(&env, Party::Producer, epoch, &product_owner, amount);
        } else {
            storage::add_purchase(&env, Party::Roaster, epoch, &product_owner, amount);
            if let Some(producer) = producer {
                storage::add_purchase(&env, Party::Producer, epoch, &producer, amount);
            }
        }

        storage::add_total_purchases(&env, epoch, amount);
        storage::add_total_profit(&env, epoch, profit);
        Ok(())
    }

    fn coffee_lover_claim_balance(env: Env, address: Address) -> i128 {
        storage::cl_balance(&env, &address)
    }

    fn coffee_lover_claim_reset(env: Env, address: Address) -> Result<(), Error> {
        Self::require_marketplace(&env)?;
        storage::set_cl_balance(&env, &address, 0);
        Ok(())
    }

    fn producer_claim_balance(env: Env, address: Address) -> i128 {
        storage::producer_balance(&env, &address)
    }

    fn producer_claim_reset(env: Env, address: Address) -> Result<(), Error> {
        Self::require_marketplace(&env)?;
        storage::set_producer_balance(&env, &address, 0);
        Ok(())
    }

    fn roaster_claim_balance(env: Env, address: Address) -> i128 {
        storage::roaster_balance(&env, &address)
    }

    fn roaster_claim_reset(env: Env, address: Address) -> Result<(), Error> {
        Self::require_marketplace(&env)?;
        storage::set_roaster_balance(&env, &address, 0);
        Ok(())
    }

    fn cambiatus_claim_balance(env: Env) -> i128 {
        storage::cambiatus_balance(&env)
    }

    fn cambiatus_claim_reset(env: Env) -> Result<(), Error> {
        Self::require_marketplace(&env)?;
        storage::set_cambiatus_balance(&env, 0);
        Ok(())
    }

    fn cofiblocks_claim_balance(env: Env) -> i128 {
        storage::cofiblocks_balance(&env)
    }

    fn cofiblocks_claim_reset(env: Env) -> Result<(), Error> {
        Self::require_marketplace(&env)?;
        storage::set_cofiblocks_balance(&env, 0);
        Ok(())
    }

    fn cofounder_claim_balance(env: Env, address: Address) -> i128 {
        storage::cofounder_balance(&env, &address)
    }

    fn cofounder_claim_reset(env: Env, address: Address) -> Result<(), Error> {
        Self::require_marketplace(&env)?;
        storage::set_cofounder_balance(&env, &address, 0);
        Ok(())
    }

    fn get_total_purchases(env: Env) -> i128 {
        storage::total_purchases(&env, storage::epoch(&env))
    }

    fn get_total_profit(env: Env) -> i128 {
        storage::total_profit(&env, storage::epoch(&env))
    }
}

/// `value * percentage %`, multiplicando antes de dividir para no perder
/// precisión en la división entera. Idéntica a `percentage_of` de Cairo.
fn percentage_of(value: i128, percentage: i128) -> i128 {
    value * percentage * 100 / 10_000
}
