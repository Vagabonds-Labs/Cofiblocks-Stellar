#![cfg(test)]
extern crate std;

use soroban_sdk::testutils::{
    Address as _, AuthorizedFunction, AuthorizedInvocation, Events, MockAuth, MockAuthInvoke,
};
use soroban_sdk::{token, vec, Address, Env, Event, IntoVal, String, Symbol, Vec};

use crate::{Error, ListedProduct, Marketplace, MarketplaceClient, Role, MAX_ITEMS_PER_PURCHASE};

/// USDC en Stellar es un activo clásico: 7 decimales, no 6.
const ONE_USDC: i128 = 10_000_000;
/// Fee de mercado de producción: 5 000 bps = 50 %.
const MARKET_FEE_BPS: u32 = 5_000;

struct Setup<'a> {
    env: Env,
    admin: Address,
    marketplace: MarketplaceClient<'a>,
    marketplace_id: Address,
    distribution_id: Address,
    usdc: token::TokenClient<'a>,
    usdc_admin: token::StellarAssetClient<'a>,
}

impl<'a> Setup<'a> {
    fn new() -> Setup<'a> {
        let env = Env::default();
        let admin = Address::generate(&env);

        let usdc_sac = env.register_stellar_asset_contract_v2(admin.clone());
        let usdc_id = usdc_sac.address();

        let distribution_id = env.register(distribution::Distribution, (admin.clone(),));
        let marketplace_id = env.register(
            Marketplace,
            (
                distribution_id.clone(),
                usdc_id.clone(),
                admin.clone(),
                MARKET_FEE_BPS,
            ),
        );

        // El marketplace es el único que puede registrar compras y resetear saldos.
        env.mock_all_auths();
        distribution::DistributionClient::new(&env, &distribution_id)
            .set_marketplace(&marketplace_id);

        Setup {
            marketplace: MarketplaceClient::new(&env, &marketplace_id),
            usdc: token::TokenClient::new(&env, &usdc_id),
            usdc_admin: token::StellarAssetClient::new(&env, &usdc_id),
            env,
            admin,
            marketplace_id,
            distribution_id,
        }
    }

    fn seller(&self, role: Role) -> Address {
        let seller = Address::generate(&self.env);
        self.marketplace.assign_role(&role, &seller);
        seller
    }

    fn buyer_with(&self, amount: i128) -> Address {
        let buyer = Address::generate(&self.env);
        self.usdc_admin.mint(&buyer, &amount);
        buyer
    }

    fn distribution(&self) -> distribution::DistributionClient<'a> {
        distribution::DistributionClient::new(&self.env, &self.distribution_id)
    }
}

fn desc(env: &Env) -> String {
    String::from_str(env, "producto-de-prueba")
}

// ══════════════════════════════════════════════════════════════════════════
// constructor
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn constructor_guarda_la_configuracion() {
    let s = Setup::new();
    assert_eq!(s.marketplace.get_admin(), s.admin);
    assert_eq!(s.marketplace.get_distribution(), s.distribution_id);
    assert_eq!(s.marketplace.get_market_fee(), MARKET_FEE_BPS);
    // Los token_id arrancan en 1, igual que el contrato Cairo.
    assert_eq!(s.marketplace.get_next_token_id(), 1);
}

// ══════════════════════════════════════════════════════════════════════════
// roles
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn asigna_y_revoca_los_seis_roles() {
    let s = Setup::new();
    s.env.mock_all_auths();

    for role in [
        Role::Producer,
        Role::Roaster,
        Role::Cambiatus,
        Role::Cofiblocks,
        Role::Cofounder,
        Role::Consumer,
    ] {
        let account = Address::generate(&s.env);
        assert!(!s.marketplace.account_has_role(&role, &account));

        s.marketplace.assign_role(&role, &account);
        assert!(s.marketplace.account_has_role(&role, &account));

        s.marketplace.account_revoke_role(&role, &account);
        assert!(!s.marketplace.account_has_role(&role, &account));
    }
}

#[test]
fn asignar_rol_exige_autorizacion_del_admin() {
    let s = Setup::new();
    let intruso = Address::generate(&s.env);
    let victima = Address::generate(&s.env);

    // Autorización real: firma el intruso, no el admin.
    s.env.set_auths(&[]);
    let result = s
        .marketplace
        .mock_auths(&[MockAuth {
            address: &intruso,
            invoke: &MockAuthInvoke {
                contract: &s.marketplace_id,
                fn_name: "assign_role",
                args: (Role::Producer, victima.clone()).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_assign_role(&Role::Producer, &victima);

    assert!(result.is_err(), "un no-admin no puede asignar roles");
    assert!(!s.marketplace.account_has_role(&Role::Producer, &victima));
}

#[test]
fn asignar_rol_registra_la_autorizacion_del_admin() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let account = Address::generate(&s.env);
    s.marketplace.assign_role(&Role::Producer, &account);

    assert_eq!(
        s.env.auths(),
        std::vec![(
            s.admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.marketplace_id.clone(),
                    Symbol::new(&s.env, "assign_role"),
                    (Role::Producer, account.clone()).into_val(&s.env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
}

// ══════════════════════════════════════════════════════════════════════════
// create_product
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn crea_producto_y_le_suma_el_fee_de_mercado() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);

    let price = 10 * ONE_USDC;
    let token_id = s
        .marketplace
        .create_product(&producer, &50, &price, &None, &desc(&s.env));

    assert_eq!(token_id, 1);
    let product = s.marketplace.get_product(&token_id);
    assert_eq!(
        product,
        ListedProduct {
            token_id: 1,
            stock: 50,
            sells: 0,
            price_usdc: price,
            // 5 000 bps sobre el precio: el comprador paga 15 USDC, el vendedor cobra 10.
            price_usdc_with_fee: price + price / 2,
            is_producer: true,
            owner: producer.clone(),
            associated_producer: None,
            short_description: desc(&s.env),
            is_available: true,
        }
    );

    // El siguiente producto toma el token_id siguiente.
    let segundo = s
        .marketplace
        .create_product(&producer, &1, &price, &None, &desc(&s.env));
    assert_eq!(segundo, 2);
}

#[test]
fn tostador_crea_producto_con_productor_asociado() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let roaster = s.seller(Role::Roaster);
    let producer = Address::generate(&s.env);

    let token_id = s.marketplace.create_product(
        &roaster,
        &10,
        &(5 * ONE_USDC),
        &Some(producer.clone()),
        &desc(&s.env),
    );

    let product = s.marketplace.get_product(&token_id);
    assert!(!product.is_producer);
    assert_eq!(product.associated_producer, Some(producer));
}

#[test]
fn create_product_rechaza_a_quien_no_es_vendedor() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let cualquiera = Address::generate(&s.env);

    let err = s
        .marketplace
        .try_create_product(&cualquiera, &10, &ONE_USDC, &None, &desc(&s.env))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::CallerIsNotASeller);
}

#[test]
fn create_product_valida_stock_y_precio() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);

    // stock 0
    assert_eq!(
        s.marketplace
            .try_create_product(&producer, &0, &ONE_USDC, &None, &desc(&s.env))
            .unwrap_err()
            .unwrap(),
        Error::InvalidStock
    );
    // stock > 1000
    assert_eq!(
        s.marketplace
            .try_create_product(&producer, &1001, &ONE_USDC, &None, &desc(&s.env))
            .unwrap_err()
            .unwrap(),
        Error::InvalidStock
    );
    // precio 0
    assert_eq!(
        s.marketplace
            .try_create_product(&producer, &10, &0, &None, &desc(&s.env))
            .unwrap_err()
            .unwrap(),
        Error::InvalidPrice
    );
    // 1000 es válido: es el límite, no lo excede
    assert!(s
        .marketplace
        .try_create_product(&producer, &1000, &ONE_USDC, &None, &desc(&s.env))
        .is_ok());
}

#[test]
fn create_product_exige_la_firma_del_vendedor() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let impostor = Address::generate(&s.env);

    // Firma el impostor una creación a nombre del productor.
    s.env.set_auths(&[]);
    let result = s
        .marketplace
        .mock_auths(&[MockAuth {
            address: &impostor,
            invoke: &MockAuthInvoke {
                contract: &s.marketplace_id,
                fn_name: "create_product",
                args: (
                    producer.clone(),
                    10u32,
                    ONE_USDC,
                    None::<Address>,
                    desc(&s.env),
                )
                    .into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));

    assert!(
        result.is_err(),
        "sólo el vendedor puede publicar a su nombre"
    );
}

// ══════════════════════════════════════════════════════════════════════════
// add_stock / delete_product
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn add_stock_incrementa_el_contador() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id = s
        .marketplace
        .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));

    s.marketplace.add_stock(&producer, &token_id, &15);
    assert_eq!(s.marketplace.get_product(&token_id).stock, 25);
}

#[test]
fn add_stock_solo_lo_puede_hacer_el_dueno() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let otro = s.seller(Role::Producer);
    let token_id = s
        .marketplace
        .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));

    assert_eq!(
        s.marketplace
            .try_add_stock(&otro, &token_id, &5)
            .unwrap_err()
            .unwrap(),
        Error::NotYourProduct
    );
}

#[test]
fn add_stock_valida_el_monto() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id = s
        .marketplace
        .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));

    assert_eq!(
        s.marketplace
            .try_add_stock(&producer, &token_id, &0)
            .unwrap_err()
            .unwrap(),
        Error::InvalidStock
    );
    assert_eq!(
        s.marketplace
            .try_add_stock(&producer, &token_id, &1001)
            .unwrap_err()
            .unwrap(),
        Error::InvalidStock
    );
}

#[test]
fn delete_product_deslista_sin_quemar_nada() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id = s
        .marketplace
        .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));

    s.marketplace.delete_product(&producer, &token_id);

    let product = s.marketplace.get_product(&token_id);
    assert!(!product.is_available);
    assert_eq!(product.stock, 0);

    // Un producto deslistado no admite más stock.
    assert_eq!(
        s.marketplace
            .try_add_stock(&producer, &token_id, &5)
            .unwrap_err()
            .unwrap(),
        Error::ProductNotAvailable
    );
}

#[test]
fn delete_product_solo_lo_puede_hacer_el_dueno() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let otro = s.seller(Role::Producer);
    let token_id = s
        .marketplace
        .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));

    assert_eq!(
        s.marketplace
            .try_delete_product(&otro, &token_id)
            .unwrap_err()
            .unwrap(),
        Error::NotYourProduct
    );
}

#[test]
fn get_product_inexistente_da_error_de_dominio() {
    let s = Setup::new();
    assert_eq!(
        s.marketplace.try_get_product(&999).unwrap_err().unwrap(),
        Error::ProductNotFound
    );
}

// ══════════════════════════════════════════════════════════════════════════
// buy_products
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn compra_un_producto_cobra_usdc_y_acredita_al_vendedor() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let price = 10 * ONE_USDC;
    let token_id = s
        .marketplace
        .create_product(&producer, &50, &price, &None, &desc(&s.env));

    let buyer = s.buyer_with(1_000 * ONE_USDC);
    let saldo_inicial = s.usdc.balance(&buyer);

    s.marketplace
        .buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 3u32], &0);

    let price_with_fee = price + price / 2;
    let total = price_with_fee * 3;

    // El comprador pagó el precio con fee; el contrato lo tiene.
    assert_eq!(s.usdc.balance(&buyer), saldo_inicial - total);
    assert_eq!(s.usdc.balance(&s.marketplace_id), total);

    // Al vendedor se le acredita el precio sin fee.
    assert_eq!(s.marketplace.get_seller_balance(&producer), price * 3);

    let product = s.marketplace.get_product(&token_id);
    assert_eq!(product.stock, 47);
    assert_eq!(product.sells, 3);

    // La compra otorga el rol CONSUMER, del que depende el claim del reparto.
    assert!(s.marketplace.account_has_role(&Role::Consumer, &buyer));
}

#[test]
fn compra_en_lote_reemplaza_al_multicall() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let p1 = s.seller(Role::Producer);
    let p2 = s.seller(Role::Producer);

    let precio1 = 10 * ONE_USDC;
    let precio2 = 4 * ONE_USDC;
    let t1 = s
        .marketplace
        .create_product(&p1, &50, &precio1, &None, &desc(&s.env));
    let t2 = s
        .marketplace
        .create_product(&p2, &50, &precio2, &None, &desc(&s.env));

    let buyer = s.buyer_with(1_000 * ONE_USDC);
    let envio = 3 * ONE_USDC;

    s.marketplace.buy_products(
        &buyer,
        &vec![&s.env, t1, t2],
        &vec![&s.env, 2u32, 5u32],
        &envio,
    );

    let total = (precio1 + precio1 / 2) * 2 + (precio2 + precio2 / 2) * 5 + envio;
    assert_eq!(s.usdc.balance(&s.marketplace_id), total);

    assert_eq!(s.marketplace.get_seller_balance(&p1), precio1 * 2);
    assert_eq!(s.marketplace.get_seller_balance(&p2), precio2 * 5);
    assert_eq!(s.marketplace.get_product(&t1).stock, 48);
    assert_eq!(s.marketplace.get_product(&t2).stock, 45);
}

#[test]
fn la_compra_emite_los_eventos_que_verifica_el_backend() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let price = 10 * ONE_USDC;
    let token_id = s
        .marketplace
        .create_product(&producer, &50, &price, &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);
    let envio = 2 * ONE_USDC;

    s.marketplace
        .buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 3u32], &envio);

    let price_with_fee = price + price / 2;
    let m = &s.marketplace_id;

    // Se fija la lista exacta y su orden de los eventos que emite la compra: es
    // el contrato que consume el backend para `verifyBuyProductEvents` y
    // `verifyDeliveryPayment`.
    assert_eq!(
        s.env.events().all().filter_by_contract(m),
        std::vec![
            crate::events::BuyProduct {
                token_id,
                amount: 3,
                buyer: buyer.clone(),
            }
            .to_xdr(&s.env, m),
            crate::events::PaymentSeller {
                seller: producer.clone(),
                token_id,
                payment: price * 3,
            }
            .to_xdr(&s.env, m),
            crate::events::UpdateStock {
                token_id,
                new_stock: 47,
            }
            .to_xdr(&s.env, m),
            crate::events::AssignRole {
                role: Role::Consumer,
                assignee: buyer.clone(),
            }
            .to_xdr(&s.env, m),
            crate::events::BuyBatch {
                buyer: buyer.clone(),
                token_ids: vec![&s.env, token_id],
                amounts: vec![&s.env, 3u32],
                total_paid: price_with_fee * 3 + envio,
                delivery_fee: envio,
            }
            .to_xdr(&s.env, m),
        ],
    );
}

#[test]
fn la_compra_registra_el_reparto_en_distribution() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let price = 10 * ONE_USDC;
    let token_id = s
        .marketplace
        .create_product(&producer, &50, &price, &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);

    s.marketplace
        .buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 2u32], &0);

    let d = s.distribution();
    let producer_fee = price * 2;
    let profit = (price / 2) * 2;
    assert_eq!(d.get_total_purchases(), producer_fee + profit);
    assert_eq!(d.get_total_profit(), profit);
}

#[test]
fn la_compra_falla_si_no_alcanza_el_stock() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id = s
        .marketplace
        .create_product(&producer, &2, &ONE_USDC, &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);

    assert_eq!(
        s.marketplace
            .try_buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 3u32], &0)
            .unwrap_err()
            .unwrap(),
        Error::NotEnoughStock
    );
    // No se cobró nada: la validación ocurre antes de mover tokens.
    assert_eq!(s.usdc.balance(&s.marketplace_id), 0);
}

#[test]
fn la_compra_falla_si_el_producto_esta_deslistado() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id = s
        .marketplace
        .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));
    s.marketplace.delete_product(&producer, &token_id);
    let buyer = s.buyer_with(1_000 * ONE_USDC);

    assert_eq!(
        s.marketplace
            .try_buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 1u32], &0)
            .unwrap_err()
            .unwrap(),
        Error::ProductNotAvailable
    );
}

#[test]
fn la_compra_valida_la_forma_del_pedido() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let t1 = s
        .marketplace
        .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);

    // pedido vacío
    assert_eq!(
        s.marketplace
            .try_buy_products(&buyer, &vec![&s.env], &vec![&s.env], &0)
            .unwrap_err()
            .unwrap(),
        Error::InvalidPurchase
    );
    // largos distintos
    assert_eq!(
        s.marketplace
            .try_buy_products(&buyer, &vec![&s.env, t1], &vec![&s.env, 1u32, 2u32], &0)
            .unwrap_err()
            .unwrap(),
        Error::InvalidPurchase
    );
    // token_id repetido: el backend arma la lista desde orderItems, que es única
    assert_eq!(
        s.marketplace
            .try_buy_products(&buyer, &vec![&s.env, t1, t1], &vec![&s.env, 1u32, 1u32], &0)
            .unwrap_err()
            .unwrap(),
        Error::InvalidPurchase
    );
    // cantidad 0
    assert_eq!(
        s.marketplace
            .try_buy_products(&buyer, &vec![&s.env, t1], &vec![&s.env, 0u32], &0)
            .unwrap_err()
            .unwrap(),
        Error::InvalidAmount
    );
    // fee de envío negativo
    assert_eq!(
        s.marketplace
            .try_buy_products(&buyer, &vec![&s.env, t1], &vec![&s.env, 1u32], &(-1))
            .unwrap_err()
            .unwrap(),
        Error::InvalidAmount
    );
}

#[test]
fn la_compra_corta_por_encima_del_maximo_de_items() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let buyer = s.buyer_with(10_000 * ONE_USDC);

    let mut token_ids = Vec::new(&s.env);
    let mut amounts = Vec::new(&s.env);
    for _ in 0..(MAX_ITEMS_PER_PURCHASE + 1) {
        let id = s
            .marketplace
            .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));
        token_ids.push_back(id);
        amounts.push_back(1u32);
    }

    assert_eq!(
        s.marketplace
            .try_buy_products(&buyer, &token_ids, &amounts, &0)
            .unwrap_err()
            .unwrap(),
        Error::TooManyItems
    );
}

#[test]
fn la_compra_exige_la_firma_del_comprador() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id = s
        .marketplace
        .create_product(&producer, &10, &ONE_USDC, &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);
    let impostor = Address::generate(&s.env);

    // Firma el impostor una compra a nombre del comprador.
    s.env.set_auths(&[]);
    let result = s
        .marketplace
        .mock_auths(&[MockAuth {
            address: &impostor,
            invoke: &MockAuthInvoke {
                contract: &s.marketplace_id,
                fn_name: "buy_products",
                args: (
                    buyer.clone(),
                    vec![&s.env, token_id],
                    vec![&s.env, 1u32],
                    0i128,
                )
                    .into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 1u32], &0);

    assert!(result.is_err(), "nadie compra a nombre de otro");
    assert_eq!(s.usdc.balance(&s.marketplace_id), 0);
}

#[test]
fn la_compra_falla_si_el_comprador_no_tiene_usdc() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id =
        s.marketplace
            .create_product(&producer, &10, &(100 * ONE_USDC), &None, &desc(&s.env));
    let buyer = s.buyer_with(ONE_USDC); // muy poco

    assert!(s
        .marketplace
        .try_buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 1u32], &0)
        .is_err());
    assert_eq!(s.marketplace.get_product(&token_id).stock, 10);
}

// ══════════════════════════════════════════════════════════════════════════
// retiros
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn el_vendedor_cobra_su_saldo() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let price = 10 * ONE_USDC;
    let token_id = s
        .marketplace
        .create_product(&producer, &50, &price, &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);
    s.marketplace
        .buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 2u32], &0);

    let esperado = price * 2;
    assert_eq!(s.marketplace.get_seller_balance(&producer), esperado);

    s.marketplace.withdraw_seller_balance(&producer);

    assert_eq!(s.usdc.balance(&producer), esperado);
    assert_eq!(s.marketplace.get_seller_balance(&producer), 0);
}

#[test]
fn cobrar_sin_saldo_da_error() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);

    assert_eq!(
        s.marketplace
            .try_withdraw_seller_balance(&producer)
            .unwrap_err()
            .unwrap(),
        Error::NoTokensToClaim
    );
}

#[test]
fn el_vendedor_cobra_solo_con_su_propia_firma() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id =
        s.marketplace
            .create_product(&producer, &50, &(10 * ONE_USDC), &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);
    s.marketplace
        .buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 1u32], &0);

    let ladron = Address::generate(&s.env);
    s.env.set_auths(&[]);
    let result = s
        .marketplace
        .mock_auths(&[MockAuth {
            address: &ladron,
            invoke: &MockAuthInvoke {
                contract: &s.marketplace_id,
                fn_name: "withdraw_seller_balance",
                args: (producer.clone(),).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_withdraw_seller_balance(&producer);

    assert!(result.is_err());
    assert_eq!(s.usdc.balance(&producer), 0);
}

#[test]
fn el_admin_retira_el_usdc_del_contrato() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id =
        s.marketplace
            .create_product(&producer, &50, &(10 * ONE_USDC), &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);
    s.marketplace
        .buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 1u32], &0);

    let destino = Address::generate(&s.env);
    s.marketplace.withdraw(&(5 * ONE_USDC), &destino);
    assert_eq!(s.usdc.balance(&destino), 5 * ONE_USDC);
}

#[test]
fn withdraw_admin_no_puede_sacar_mas_de_lo_que_hay() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let destino = Address::generate(&s.env);

    assert_eq!(
        s.marketplace
            .try_withdraw(&(5 * ONE_USDC), &destino)
            .unwrap_err()
            .unwrap(),
        Error::ContractInsufficientBalance
    );
}

#[test]
fn withdraw_exige_firma_del_admin() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let token_id =
        s.marketplace
            .create_product(&producer, &50, &(10 * ONE_USDC), &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);
    s.marketplace
        .buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 1u32], &0);

    let intruso = Address::generate(&s.env);
    s.env.set_auths(&[]);
    let result = s
        .marketplace
        .mock_auths(&[MockAuth {
            address: &intruso,
            invoke: &MockAuthInvoke {
                contract: &s.marketplace_id,
                fn_name: "withdraw",
                args: (ONE_USDC, intruso.clone()).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_withdraw(&ONE_USDC, &intruso);

    assert!(result.is_err());
    assert_eq!(s.usdc.balance(&intruso), 0);
}

// ══════════════════════════════════════════════════════════════════════════
// reparto de utilidades
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn el_coffee_lover_reclama_su_parte_del_reparto() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let price = 100 * ONE_USDC;
    let token_id = s
        .marketplace
        .create_product(&producer, &50, &price, &None, &desc(&s.env));
    let buyer = s.buyer_with(1_000 * ONE_USDC);
    s.marketplace
        .buy_products(&buyer, &vec![&s.env, token_id], &vec![&s.env, 2u32], &0);

    // Reparto completo (una sola página alcanza para este padrón).
    let progress = s.distribution().distribute(&0, &50);
    assert!(progress.done);

    let profit = (price / 2) * 2;
    // Único coffee lover: se lleva el 30 % del profit.
    let esperado = profit * 30 / 100;
    assert_eq!(
        s.distribution().coffee_lover_claim_balance(&buyer),
        esperado
    );

    // El rol CONSUMER que otorgó la compra es lo que le habilita el claim.
    s.marketplace
        .withdraw_distribution_balance(&buyer, &Role::Consumer);
    assert_eq!(
        s.usdc.balance(&buyer),
        1_000 * ONE_USDC - (price + price / 2) * 2 + esperado
    );
    assert_eq!(s.distribution().coffee_lover_claim_balance(&buyer), 0);
}

#[test]
fn reclamar_sin_el_rol_correspondiente_falla() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let cualquiera = Address::generate(&s.env);

    assert_eq!(
        s.marketplace
            .try_withdraw_distribution_balance(&cualquiera, &Role::Consumer)
            .unwrap_err()
            .unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn reclamar_sin_saldo_acumulado_falla() {
    let s = Setup::new();
    s.env.mock_all_auths();
    let cofounder = s.seller(Role::Cofounder);

    assert_eq!(
        s.marketplace
            .try_withdraw_distribution_balance(&cofounder, &Role::Cofounder)
            .unwrap_err()
            .unwrap(),
        Error::NoTokensToClaim
    );
}

// ══════════════════════════════════════════════════════════════════════════
// presupuesto de recursos
// ══════════════════════════════════════════════════════════════════════════

/// Límites por transacción de mainnet, protocolo 27.
/// Consultados con `stellar network settings --network mainnet` el 2026-09-02.
mod mainnet_limits {
    pub const TX_MAX_WRITE_LEDGER_ENTRIES: u32 = 200;
    pub const TX_MAX_WRITE_BYTES: u32 = 132_096;
    pub const TX_MAX_FOOTPRINT_ENTRIES: u32 = 400;
    pub const TX_MAX_CONTRACT_EVENTS_SIZE_BYTES: u32 = 16_384;
}

/// Recursos de una invocación. Copia local: el tipo del SDK no es público.
struct Recursos {
    instructions: i64,
    mem_bytes: i64,
    write_entries: u32,
    write_bytes: u32,
    footprint_entries: u32,
    events_bytes: u32,
}

/// Mide una compra de `items` productos distintos.
fn medir_compra(items: u32) -> Recursos {
    let s = Setup::new();
    s.env.mock_all_auths();
    let producer = s.seller(Role::Producer);
    let buyer = s.buyer_with(1_000_000 * ONE_USDC);

    let mut token_ids = Vec::new(&s.env);
    let mut amounts = Vec::new(&s.env);
    for _ in 0..items {
        let id = s
            .marketplace
            .create_product(&producer, &1000, &ONE_USDC, &None, &desc(&s.env));
        token_ids.push_back(id);
        amounts.push_back(1u32);
    }

    s.marketplace
        .buy_products(&buyer, &token_ids, &amounts, &ONE_USDC);

    let r = s.env.cost_estimate().resources();
    Recursos {
        instructions: r.instructions,
        mem_bytes: r.mem_bytes,
        write_entries: r.write_entries,
        write_bytes: r.write_bytes,
        footprint_entries: r.memory_read_entries + r.write_entries,
        events_bytes: r.contract_events_size_bytes,
    }
}

/// Una compra del tamaño máximo tiene que entrar en el presupuesto de mainnet.
///
/// `Env::default()` ya enforcea límites de recursos, así que este test falla
/// solo si `MAX_ITEMS_PER_PURCHASE` sube por encima de lo que el host tolera.
///
/// Las dimensiones que asserta abajo (entradas, bytes, eventos) son
/// representativas aunque el test corra el contrato nativo en vez del WASM.
/// El número de instrucciones **no** lo es: queda subestimado porque no incluye
/// instanciación ni ejecución de la VM. La medición que manda para la CPU es la
/// simulación contra testnet con el WASM desplegado (fase 2).
#[test]
fn una_compra_del_maximo_de_items_entra_en_el_presupuesto_de_mainnet() {
    use mainnet_limits::*;

    let r = medir_compra(MAX_ITEMS_PER_PURCHASE);

    std::println!(
        "buy_products x{}: instr={} mem={}B escrituras={} bytes={} eventos={}B footprint={}",
        MAX_ITEMS_PER_PURCHASE,
        r.instructions,
        r.mem_bytes,
        r.write_entries,
        r.write_bytes,
        r.events_bytes,
        r.footprint_entries,
    );

    assert!(
        r.events_bytes < TX_MAX_CONTRACT_EVENTS_SIZE_BYTES,
        "los eventos de la compra ({} B) superan el límite de mainnet ({} B); \
         hay que bajar MAX_ITEMS_PER_PURCHASE",
        r.events_bytes,
        TX_MAX_CONTRACT_EVENTS_SIZE_BYTES
    );
    assert!(r.write_entries < TX_MAX_WRITE_LEDGER_ENTRIES);
    assert!(r.write_bytes < TX_MAX_WRITE_BYTES);
    assert!(r.footprint_entries < TX_MAX_FOOTPRINT_ENTRIES);
}

/// Fija cuánto cuesta cada ítem adicional.
///
/// Medido el 2026-09-02 con soroban-sdk 27.0.6: la compra arranca en ~1 192 B de
/// eventos y suma ~544 B por ítem, 1 entrada escrita y 2 de footprint. Con el
/// tope de 16 KB de eventos de mainnet, el techo teórico ronda los 28 ítems;
/// `MAX_ITEMS_PER_PURCHASE` queda por debajo a propósito.
#[test]
fn el_costo_de_la_compra_crece_linealmente_con_los_items() {
    let uno = medir_compra(1);
    let tope = medir_compra(MAX_ITEMS_PER_PURCHASE);
    let n = MAX_ITEMS_PER_PURCHASE - 1;

    std::println!(
        "por ítem: eventos={}B escrituras={} footprint={}",
        (tope.events_bytes - uno.events_bytes) / n,
        (tope.write_entries - uno.write_entries) / n,
        (tope.footprint_entries - uno.footprint_entries) / n,
    );

    assert_eq!((tope.events_bytes - uno.events_bytes) / n, 544);
    assert_eq!((tope.write_entries - uno.write_entries) / n, 1);
    assert_eq!((tope.footprint_entries - uno.footprint_entries) / n, 2);
}
