# Contratos de CofiBlocks (Soroban)

Dos contratos en Rust sobre Stellar/Soroban:

| Contrato | Qué hace |
|---|---|
| `marketplace` | Roles, productos, stock, compra en lote, saldos de vendedor y claims del reparto. |
| `distribution` | Registra las compras y reparte las utilidades de a páginas. |

`interfaces` es un crate compartido con los tipos y el cliente que el marketplace
usa para invocar a `distribution`, sin arrastrar su implementación al WASM.

## Lo que ya no existe

La versión Starknet tenía cuatro contratos. Se cayeron dos:

- **`cofi_collection` (ERC-1155).** Soroban no tiene equivalente multi-token y se
  decidió no escribirlo. El stock vive en `ListedProduct` dentro del marketplace;
  el NFT era una representación paralela. Con él se van el base URI, el metadata
  IPFS, `TOKEN_METADATA_URL` y el paso post-deploy `set_minter`.
- **`swap` (Ekubo).** Sólo se paga en USDC.

## Requisitos

```bash
cargo install --locked stellar-cli   # 28.x
rustup target add wasm32v1-none
```

## Test

```bash
cargo test --workspace
```

`Env::default()` enforcea los límites de recursos de mainnet, así que la suite
falla si un contrato se vuelve demasiado pesado para la red.

## Build

```bash
stellar contract build
```

Deja los WASM en `target/wasm32v1-none/release/`.

## Despliegue

Primero, el entorno de testnet — identidades, fondeo, trustlines y un USDC de
prueba con los mismos 7 decimales que el real:

```bash
../scripts/setup-testnet.sh
```

Después:

```bash
./scripts/deploy.sh testnet
./scripts/deploy.sh mainnet
```

El script compila, sube y despliega los dos contratos, enlaza `distribution` con
el marketplace (`set_marketplace`) y escribe `deployments/<network>.json` con el
mismo formato que consume `getContractAddress()` en el backend.

Variables opcionales: `STELLAR_ADMIN_IDENTITY` (por defecto `cofi-admin`),
`MARKET_FEE_BPS` (por defecto `5000`, o sea 50 %), `USDC_ISSUER`.

En **mainnet** se usa el USDC de Circle
(`GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`), verificado en
7 decimales. En **testnet** se usa un activo propio: el de Circle no lo podemos
emitir.

## Recorrido punta a punta

```bash
./scripts/e2e-testnet.sh
```

Rol → publicar → comprar → cobrar → repartir → reclamar, todo on-chain y con los
saldos verificados. Es el criterio de aceptación del despliegue.

## Notas de diseño

- **Una sola invocación por transacción.** Stellar admite un único
  `InvokeHostFunction` por transacción, así que el multicall del checkout
  (`approve` + N × `buy_product` + `transfer` del envío) se colapsó en
  `buy_products(buyer, token_ids, amounts, delivery_fee)`.
- **Sin `approve`.** La autorización viaja por el árbol de invocación: el
  marketplace hace `usdc.transfer(&buyer, …)` y el `require_auth()` del comprador
  queda cubierto por la firma de la transacción.
- **`i128` y 7 decimales.** USDC en Stellar es un activo clásico. Se fue el par
  `low`/`high` de `u256`.
- **Eventos legibles.** Topics con símbolos y datos indexados por nombre de
  campo (`#[contractevent]`), en vez de selectores hexadecimales.
- **Reparto paginado.** `distribute(cursor, limit)` congela un *epoch* al
  arrancar: las compras que entran durante el reparto se acumulan en el epoch
  siguiente y no interfieren.
- **TTL.** Toda escritura extiende el TTL de la entrada. `touch_product` permite
  al panel admin evitar que un producto inactivo se archive.
