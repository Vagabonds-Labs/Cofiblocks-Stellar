use soroban_sdk::{contracttype, Address};

pub use cofiblocks_interfaces::{DistributeProgress, DistributionError as Error, Phase};

/// Estado de un reparto en curso.
///
/// El reparto congela un *epoch*: al arrancar, las compras nuevas pasan a
/// registrarse en el epoch siguiente. Así la paginación no compite con las
/// compras que entran mientras el reparto avanza, que era el riesgo de
/// paginar el `distribute()` monolítico de Cairo.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Run {
    /// Epoch congelado sobre el que se reparte.
    pub epoch: u32,
    /// Totales tomados al arrancar. No cambian durante el reparto.
    pub total_purchases: i128,
    pub total_profit: i128,
    pub phase: Phase,
    pub cursor: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Marketplace,
    /// Epoch actual: dónde se acumulan las compras que entran ahora.
    Epoch,
    Run,

    TotalPurchases(u32),
    TotalProfit(u32),

    ClCount(u32),
    ClAt(u32, u32),
    PurchasePerCl(u32, Address),

    ProducerCount(u32),
    ProducerAt(u32, u32),
    PurchasePerProducer(u32, Address),

    RoasterCount(u32),
    RoasterAt(u32, u32),
    PurchasePerRoaster(u32, Address),

    CofounderCount,
    CofounderAt(u32),

    ClBalance(Address),
    ProducerBalance(Address),
    RoasterBalance(Address),
    CambiatusBalance,
    CofiblocksBalance,
    CofounderBalance(Address),
}

/// Cuál de las tres listas paginadas se está procesando.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Party {
    CoffeeLover,
    Producer,
    Roaster,
}
