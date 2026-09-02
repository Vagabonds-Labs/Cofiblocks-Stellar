#![cfg(test)]
extern crate std;

use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
use soroban_sdk::{Address, Env, IntoVal};

use crate::{Distribution, DistributionClient, Error, Phase};

const ONE_USDC: i128 = 10_000_000;
/// Fee de mercado de producción: 5 000 bps. La utilidad es el 50 % del precio.
const MARKET_FEE_BPS: i128 = 5_000;

fn profit_of(price: i128) -> i128 {
    price * MARKET_FEE_BPS / 10_000
}

/// `value * percentage %`. Idéntica a `percentage_of` del contrato y de Cairo.
fn percentage_of(value: i128, percentage: i128) -> i128 {
    value * percentage * 100 / 10_000
}

struct Setup<'a> {
    env: Env,
    admin: Address,
    marketplace: Address,
    distribution_id: Address,
    d: DistributionClient<'a>,
}

impl<'a> Setup<'a> {
    fn new() -> Setup<'a> {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let marketplace = Address::generate(&env);

        let distribution_id = env.register(Distribution, (admin.clone(),));
        let d = DistributionClient::new(&env, &distribution_id);
        d.set_marketplace(&marketplace);

        Setup {
            env,
            admin,
            marketplace,
            distribution_id,
            d,
        }
    }

    /// Compra de un producto de un productor.
    fn buy_from_producer(&self, buyer: &Address, producer: &Address, price: i128) {
        self.d
            .register_purchase(buyer, producer, &true, &None, &price, &profit_of(price));
    }

    /// Compra de un producto de un tostador, con productor asociado.
    fn buy_from_roaster(
        &self,
        buyer: &Address,
        roaster: &Address,
        producer: Option<Address>,
        price: i128,
    ) {
        self.d
            .register_purchase(buyer, roaster, &false, &producer, &price, &profit_of(price));
    }

    /// Retoma un reparto ya arrancado y lo lleva hasta el final.
    fn distribute_all_from(&self, mut cursor: u32) {
        loop {
            let p = self.d.distribute(&cursor, &50);
            if p.done {
                return;
            }
            cursor = p.next_cursor;
        }
    }

    /// Corre el reparto entero de a páginas de `limit`, devolviendo la cantidad
    /// de páginas que hizo falta.
    fn distribute_all(&self, limit: u32) -> u32 {
        let mut cursor = 0;
        let mut pages = 0;
        loop {
            let progress = self.d.distribute(&cursor, &limit);
            pages += 1;
            if progress.done {
                return pages;
            }
            cursor = progress.next_cursor;
            assert!(pages < 100, "el reparto no termina");
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// register_purchase
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn register_purchase_acumula_totales() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let b1 = Address::generate(&s.env);
    let b2 = Address::generate(&s.env);

    let p1 = 1_000 * ONE_USDC;
    let p2 = 2_000 * ONE_USDC;
    s.buy_from_producer(&b1, &producer, p1);
    s.buy_from_producer(&b2, &producer, p2);

    let total_profit = profit_of(p1) + profit_of(p2);
    assert_eq!(s.d.get_total_profit(), total_profit);
    assert_eq!(s.d.get_total_purchases(), p1 + p2 + total_profit);
}

#[test]
fn register_purchase_solo_lo_puede_llamar_el_marketplace() {
    let s = Setup::new();
    let intruso = Address::generate(&s.env);
    let producer = Address::generate(&s.env);

    s.env.set_auths(&[]);
    let result =
        s.d.mock_auths(&[MockAuth {
            address: &intruso,
            invoke: &MockAuthInvoke {
                contract: &s.distribution_id,
                fn_name: "register_purchase",
                args: (
                    intruso.clone(),
                    producer.clone(),
                    true,
                    None::<Address>,
                    ONE_USDC,
                    ONE_USDC,
                )
                    .into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_register_purchase(&intruso, &producer, &true, &None, &ONE_USDC, &ONE_USDC);

    assert!(result.is_err());
    assert_eq!(s.d.get_total_profit(), 0);
}

#[test]
fn register_purchase_rechaza_montos_negativos() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);

    assert_eq!(
        s.d.try_register_purchase(&buyer, &producer, &true, &None, &(-1), &0)
            .unwrap_err()
            .unwrap(),
        Error::InvalidAmount
    );
}

// ══════════════════════════════════════════════════════════════════════════
// reparto: los seis porcentajes
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn reparte_el_30_por_ciento_entre_los_coffee_lovers() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let b1 = Address::generate(&s.env);
    let b2 = Address::generate(&s.env);

    let p1 = 1_000 * ONE_USDC;
    let p2 = 2_000 * ONE_USDC;
    s.buy_from_producer(&b1, &producer, p1);
    s.buy_from_producer(&b2, &producer, p2);

    s.distribute_all(50);

    let total_profit = profit_of(p1) + profit_of(p2);
    let total_purchases = p1 + p2 + total_profit;
    let cl_profits = percentage_of(total_profit, 30);

    let pct1 = (p1 + profit_of(p1)) * 100 / total_purchases;
    assert_eq!(
        s.d.coffee_lover_claim_balance(&b1),
        percentage_of(cl_profits, pct1)
    );

    let pct2 = (p2 + profit_of(p2)) * 100 / total_purchases;
    assert_eq!(
        s.d.coffee_lover_claim_balance(&b2),
        percentage_of(cl_profits, pct2)
    );

    // Los totales quedan reseteados, igual que en Cairo.
    assert_eq!(s.d.get_total_profit(), 0);
    assert_eq!(s.d.get_total_purchases(), 0);
}

#[test]
fn reparte_el_30_por_ciento_entre_los_productores() {
    let s = Setup::new();
    let prod1 = Address::generate(&s.env);
    let prod2 = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);

    let p1 = 1_000 * ONE_USDC;
    let p2 = 2_000 * ONE_USDC;
    s.buy_from_producer(&buyer, &prod1, p1);
    s.buy_from_producer(&buyer, &prod2, p2);

    s.distribute_all(50);

    let total_profit = profit_of(p1) + profit_of(p2);
    let total_purchases = p1 + p2 + total_profit;
    let pool = percentage_of(total_profit, 30);

    let pct1 = (p1 + profit_of(p1)) * 100 / total_purchases;
    assert_eq!(
        s.d.producer_claim_balance(&prod1),
        percentage_of(pool, pct1)
    );
    let pct2 = (p2 + profit_of(p2)) * 100 / total_purchases;
    assert_eq!(
        s.d.producer_claim_balance(&prod2),
        percentage_of(pool, pct2)
    );
}

#[test]
fn reparte_el_5_por_ciento_al_tostador_y_el_30_a_su_productor() {
    let s = Setup::new();
    let roaster = Address::generate(&s.env);
    let producer = Address::generate(&s.env);
    let b1 = Address::generate(&s.env);
    let b2 = Address::generate(&s.env);

    let p1 = 1_000 * ONE_USDC;
    let p2 = 2_000 * ONE_USDC;
    s.buy_from_roaster(&b1, &roaster, Some(producer.clone()), p1);
    s.buy_from_roaster(&b2, &roaster, Some(producer.clone()), p2);

    s.distribute_all(50);

    let total_profit = profit_of(p1) + profit_of(p2);

    // Único tostador: se lleva el 100 % del 5 %.
    let roaster_pool = percentage_of(total_profit, 5);
    assert_eq!(
        s.d.roaster_claim_balance(&roaster),
        percentage_of(roaster_pool, 100)
    );

    // Único productor asociado: se lleva el 100 % del 30 %.
    let producer_pool = percentage_of(total_profit, 30);
    assert_eq!(
        s.d.producer_claim_balance(&producer),
        percentage_of(producer_pool, 100)
    );
}

#[test]
fn tostador_sin_productor_asociado_no_acredita_productor() {
    let s = Setup::new();
    let roaster = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);

    s.buy_from_roaster(&buyer, &roaster, None, 1_000 * ONE_USDC);
    s.distribute_all(50);

    assert!(s.d.roaster_claim_balance(&roaster) > 0);
    // Nadie más recibe la parte de productor: no hay a quién acreditarla.
    assert_eq!(s.d.producer_claim_balance(&roaster), 0);
}

#[test]
fn reparte_el_2_por_ciento_a_cambiatus_y_el_24_a_cofiblocks() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);

    let price = 1_000 * ONE_USDC;
    s.buy_from_producer(&buyer, &producer, price);
    s.distribute_all(50);

    let total_profit = profit_of(price);
    assert_eq!(
        s.d.cambiatus_claim_balance(),
        percentage_of(total_profit, 2)
    );
    assert_eq!(
        s.d.cofiblocks_claim_balance(),
        percentage_of(total_profit, 24)
    );
}

#[test]
fn reparte_el_9_por_ciento_entre_los_cofundadores() {
    let s = Setup::new();
    let c1 = Address::generate(&s.env);
    let c2 = Address::generate(&s.env);
    s.d.add_cofounder(&c1);
    s.d.add_cofounder(&c2);
    assert_eq!(s.d.get_cofounder_count(), 2);

    let producer = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);
    let p1 = 1_000 * ONE_USDC;
    let p2 = 2_000 * ONE_USDC;
    s.buy_from_producer(&buyer, &producer, p1);
    s.buy_from_producer(&buyer, &producer, p2);

    s.distribute_all(50);

    let total_profit = profit_of(p1) + profit_of(p2);
    let pool = percentage_of(total_profit, 9);
    // 100 / 2 = 50 % para cada uno (división entera, igual que Cairo).
    let esperado = percentage_of(pool, 50);
    assert_eq!(s.d.cofounder_claim_balance(&c1), esperado);
    assert_eq!(s.d.cofounder_claim_balance(&c2), esperado);
}

#[test]
fn no_se_puede_dar_de_alta_dos_veces_al_mismo_cofundador() {
    let s = Setup::new();
    let c1 = Address::generate(&s.env);
    s.d.add_cofounder(&c1);
    s.d.add_cofounder(&c1);
    assert_eq!(s.d.get_cofounder_count(), 1);
}

// ══════════════════════════════════════════════════════════════════════════
// paginación — lo que no sobrevivía de Cairo
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn el_reparto_paginado_da_lo_mismo_que_el_de_una_sola_pagina() {
    // Mismo escenario repartido de a 1 y de a 50: los saldos deben coincidir.
    let escenario = |limit: u32| {
        let s = Setup::new();
        let producer = Address::generate(&s.env);
        let mut buyers = std::vec::Vec::new();
        for i in 0..7u32 {
            let buyer = Address::generate(&s.env);
            s.buy_from_producer(&buyer, &producer, (100 + i as i128) * ONE_USDC);
            buyers.push(buyer);
        }
        let pages = s.distribute_all(limit);
        let saldos: std::vec::Vec<i128> = buyers
            .iter()
            .map(|b| s.d.coffee_lover_claim_balance(b))
            .collect();
        (saldos, s.d.producer_claim_balance(&producer), pages)
    };

    let (de_a_uno, prod_uno, pages_uno) = escenario(1);
    let (de_una_vez, prod_todo, pages_todo) = escenario(50);

    assert_eq!(de_a_uno, de_una_vez);
    assert_eq!(prod_uno, prod_todo);
    assert!(de_a_uno.iter().all(|v| *v > 0));
    // Paginar de a uno cuesta más llamadas; repartir de una sola vez, una.
    assert!(pages_uno > pages_todo);
    assert_eq!(pages_todo, 1);
}

#[test]
fn el_reparto_avanza_de_fase_y_reporta_el_cursor() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    for _ in 0..3 {
        let buyer = Address::generate(&s.env);
        s.buy_from_producer(&buyer, &producer, 100 * ONE_USDC);
    }

    // Primera página: dos coffee lovers de tres.
    let p1 = s.d.distribute(&0, &2);
    assert_eq!(p1.phase, Phase::CoffeeLovers);
    assert_eq!(p1.processed, 2);
    assert_eq!(p1.next_cursor, 2);
    assert!(!p1.done);

    // Segunda página: el tercer coffee lover; la fase pasa a productores.
    let p2 = s.d.distribute(&2, &1);
    assert_eq!(p2.processed, 1);
    assert_eq!(p2.phase, Phase::Producers);
    assert_eq!(p2.next_cursor, 0);
    assert!(!p2.done);

    // El resto entra en una página.
    let p3 = s.d.distribute(&0, &50);
    assert!(p3.done);
}

#[test]
fn el_reparto_rechaza_un_cursor_que_no_corresponde() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    for _ in 0..3 {
        let buyer = Address::generate(&s.env);
        s.buy_from_producer(&buyer, &producer, 100 * ONE_USDC);
    }

    let p1 = s.d.distribute(&0, &1);
    assert_eq!(p1.next_cursor, 1);

    // Saltearse una cuenta o pagarle dos veces: ambos rechazados.
    assert_eq!(
        s.d.try_distribute(&2, &1).unwrap_err().unwrap(),
        Error::InvalidCursor
    );
    assert_eq!(
        s.d.try_distribute(&0, &1).unwrap_err().unwrap(),
        Error::InvalidCursor
    );
    // Con el cursor correcto sigue.
    assert!(s.d.try_distribute(&1, &1).is_ok());
}

#[test]
fn arrancar_un_reparto_con_cursor_distinto_de_cero_falla() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);
    s.buy_from_producer(&buyer, &producer, 100 * ONE_USDC);

    assert_eq!(
        s.d.try_distribute(&5, &10).unwrap_err().unwrap(),
        Error::InvalidCursor
    );
}

#[test]
fn no_se_reparte_si_no_hay_utilidad() {
    let s = Setup::new();
    assert_eq!(
        s.d.try_distribute(&0, &10).unwrap_err().unwrap(),
        Error::NothingToDistribute
    );
}

#[test]
fn el_reparto_exige_un_limite_positivo() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);
    s.buy_from_producer(&buyer, &producer, 100 * ONE_USDC);

    assert_eq!(
        s.d.try_distribute(&0, &0).unwrap_err().unwrap(),
        Error::InvalidAmount
    );
}

#[test]
fn las_compras_que_entran_durante_el_reparto_van_al_epoch_siguiente() {
    // Este es el riesgo que introduce paginar: si una compra cayera dentro del
    // padrón que se está recorriendo, se pagaría de más o se perdería.
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let b1 = Address::generate(&s.env);
    let b2 = Address::generate(&s.env);

    let price = 1_000 * ONE_USDC;
    s.buy_from_producer(&b1, &producer, price);
    s.buy_from_producer(&b2, &producer, price);

    let epoch_inicial = s.d.get_epoch();

    // Arranca el reparto: congela el epoch.
    let p1 = s.d.distribute(&0, &1);
    assert!(!p1.done);
    assert_eq!(s.d.get_epoch(), epoch_inicial + 1);

    // Compra en medio del reparto: se acumula en el epoch nuevo.
    let b3 = Address::generate(&s.env);
    s.buy_from_producer(&b3, &producer, price);
    assert_eq!(s.d.get_total_profit(), profit_of(price));

    // Termina el reparto del epoch congelado.
    let mut cursor = p1.next_cursor;
    loop {
        let p = s.d.distribute(&cursor, &50);
        if p.done {
            break;
        }
        cursor = p.next_cursor;
    }

    // b1 y b2 cobraron; b3 no, porque su compra es del epoch siguiente.
    assert!(s.d.coffee_lover_claim_balance(&b1) > 0);
    assert!(s.d.coffee_lover_claim_balance(&b2) > 0);
    assert_eq!(s.d.coffee_lover_claim_balance(&b3), 0);

    // Y su compra sigue viva para el próximo reparto.
    assert_eq!(s.d.get_total_profit(), profit_of(price));
    s.distribute_all(50);
    assert!(s.d.coffee_lover_claim_balance(&b3) > 0);
}

#[test]
fn dos_repartos_seguidos_acumulan_saldo() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);
    let price = 1_000 * ONE_USDC;

    s.buy_from_producer(&buyer, &producer, price);
    s.distribute_all(50);
    let primero = s.d.coffee_lover_claim_balance(&buyer);
    assert!(primero > 0);

    s.buy_from_producer(&buyer, &producer, price);
    s.distribute_all(50);
    assert_eq!(s.d.coffee_lover_claim_balance(&buyer), primero * 2);
}

#[test]
fn get_run_expone_el_reparto_en_curso() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    for _ in 0..3 {
        let buyer = Address::generate(&s.env);
        s.buy_from_producer(&buyer, &producer, 100 * ONE_USDC);
    }

    assert!(s.d.get_run().is_none());
    s.d.distribute(&0, &1);
    let run = s.d.get_run().expect("hay un reparto en curso");
    assert_eq!(run.phase, Phase::CoffeeLovers);
    assert_eq!(run.cursor, 1);

    s.distribute_all_from(run.cursor);
    assert!(s.d.get_run().is_none());
}

// ══════════════════════════════════════════════════════════════════════════
// autorización
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn el_reparto_solo_lo_dispara_el_admin() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);
    s.buy_from_producer(&buyer, &producer, 100 * ONE_USDC);

    let intruso = Address::generate(&s.env);
    s.env.set_auths(&[]);
    let result =
        s.d.mock_auths(&[MockAuth {
            address: &intruso,
            invoke: &MockAuthInvoke {
                contract: &s.distribution_id,
                fn_name: "distribute",
                args: (0u32, 10u32).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_distribute(&0, &10);

    assert!(result.is_err());
    assert!(s.d.get_run().is_none());
}

#[test]
fn resetear_un_saldo_solo_lo_puede_hacer_el_marketplace() {
    let s = Setup::new();
    let producer = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);
    s.buy_from_producer(&buyer, &producer, 1_000 * ONE_USDC);
    s.distribute_all(50);

    let saldo = s.d.coffee_lover_claim_balance(&buyer);
    assert!(saldo > 0);

    let intruso = Address::generate(&s.env);
    s.env.set_auths(&[]);
    let result =
        s.d.mock_auths(&[MockAuth {
            address: &intruso,
            invoke: &MockAuthInvoke {
                contract: &s.distribution_id,
                fn_name: "coffee_lover_claim_reset",
                args: (buyer.clone(),).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_coffee_lover_claim_reset(&buyer);

    assert!(result.is_err());
    assert_eq!(s.d.coffee_lover_claim_balance(&buyer), saldo);
}

#[test]
fn set_marketplace_y_add_cofounder_son_del_admin() {
    let s = Setup::new();
    let intruso = Address::generate(&s.env);
    let otro = Address::generate(&s.env);

    s.env.set_auths(&[]);
    assert!(s
        .d
        .mock_auths(&[MockAuth {
            address: &intruso,
            invoke: &MockAuthInvoke {
                contract: &s.distribution_id,
                fn_name: "set_marketplace",
                args: (otro.clone(),).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_set_marketplace(&otro)
        .is_err());
    assert_eq!(s.d.get_marketplace(), s.marketplace);

    assert!(s
        .d
        .mock_auths(&[MockAuth {
            address: &intruso,
            invoke: &MockAuthInvoke {
                contract: &s.distribution_id,
                fn_name: "add_cofounder",
                args: (otro.clone(),).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_add_cofounder(&otro)
        .is_err());
    assert_eq!(s.d.get_cofounder_count(), 0);
}

#[test]
fn el_constructor_guarda_al_admin() {
    let s = Setup::new();
    assert_eq!(s.d.get_admin(), s.admin);
    assert_eq!(s.d.get_epoch(), 0);
}
