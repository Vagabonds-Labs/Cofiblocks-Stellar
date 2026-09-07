# Checklist de paridad — migración Starknet → Stellar (Soroban)

**Estado:** fases 0 – 6 completas · congelado el 2026-09-02 contra el commit `2334330`.

Este documento congela el comportamiento on-chain **actual** (Starknet) y define el
criterio de aceptación de la migración. Cada flujo lista: entradas, llamadas al contrato,
eventos que el backend verifica y el estado que muta en Postgres.

La columna **Soroban** describe el destino acordado. Un flujo se da por migrado cuando
sus criterios de aceptación pasan en testnet **y** en mainnet.

---

## 0. Constantes verificadas

Verificadas contra la red el 2026-09-02 (no asumidas).

| Constante | Mainnet | Testnet |
|---|---|---|
| Network passphrase | `Public Global Stellar Network ; September 2015` | `Test SDF Network ; September 2015` |
| Soroban RPC | `https://mainnet.sorobanrpc.com` | `https://soroban-testnet.stellar.org` |
| Protocol version (al congelar) | 27 | 28 |
| USDC issuer | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| USDC SAC (contract id) | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| **USDC `decimals()`** | **7** ✅ verificado por simulación | **7** ✅ verificado por simulación |
| `name()` / `symbol()` | `USDC:GA5Z…` / `USDC` | `USDC:GBBD…` / `USDC` |

**Consecuencia directa:** `usdToWei()` pasa de `×10⁶` a `×10⁷`.
Los montos pasan de `u256` (par `low`/`high`) a `i128` nativo.
Se elimina `format_number()` y todo el manejo de `low`/`high`.

Reproducir la verificación en cualquier momento:

```bash
node scripts/verify-stellar-constants.mjs
```

Levantar el entorno de testnet (identidades, fondeo, trustlines a USDC):

```bash
./scripts/setup-testnet.sh
```

---

## 1. Checkout y verificación de pago

**El flujo más crítico. Es el único que mueve dinero del comprador.**

### Hoy (Starknet)

| | |
|---|---|
| **Endpoints** | `POST /api/orders/checkout` → `POST /api/orders/checkout/callback` |
| **Entradas** | `order_id`, `delivery_event_id` \| `delivery_home{country,state,city,address1,address2,name,phone}`, `stripe_checkout: boolean` |
| **Precondición** | `assertOrderIsPayable(order, userId)`; `OnChainBalancesService.canUserPayUSDC(wallet, orderTotal + deliveryFee)` |
| **Llamadas al contrato** | Multicall de N+2 llamadas: 1) `USDC.approve(marketplace, total)` 2) `marketplace.buy_product(token_id, amount, buyer)` × N ítems 3) `USDC.transfer(marketplace, deliveryFee)` si `deliveryFee > 0` |
| **Respuesta al frontend** | `{ txs: [{ tx: {contract_address, entrypoint, calldata}, tx_type }], checkoutUrl }` |
| **Firma** | Wallet ejecuta `wallet_addInvokeTransaction` con el array de calls; devuelve `transaction_hash` |
| **Callback** | Frontend espera 5 s fijos, luego `POST /checkout/callback { id, tx_hash }` |
| **Eventos verificados** | `verifyBuyProductEvents`: por cada `token_id` del pedido debe existir un `BuyProduct` con `amount` == ítems pedidos y `buyer` == wallet del comprador. Si `delivery.method == HOME && delivery.price`: `verifyDeliveryPayment` suma los `Transfer` de USDC hacia el marketplace y exige `total ≥ orderTotal + deliveryPrice` |
| **Guardas** | `isTxHashAlreadyUsed(txHash)` → 400 `TX_HASH_ALREADY_USED` |
| **Muta en Postgres** | `Order.status = PAID`, `Order.paymentTx = txHash`; por ítem: `Product.currentStock -= items`, `Product.reservedStock -= items`, `Product.sales += items`, `Farm.sales += items`; `OrderItem.producerClaimBalance = items × (price / 1.5)`; si HOME: `Order.status = IN_DELIVERY` y `Delivery.paymentTxHash = txHash` |
| **Efectos laterales** | Notificación `ORDER_RECEIVED` a cada dueño de producto; `ORDER_PAID` al comprador; email al productor (`notifyProducerEmail`, error tolerado) |

### Mañana (Soroban)

- **Una sola invocación.** Multicall colapsa en un único entrypoint batch:
  `buy_products(buyer, token_ids: Vec<u128>, amounts: Vec<u32>, delivery_fee: i128)`.
- **Sin `approve`.** El marketplace hace `usdc.transfer(&buyer, &market, total)`; el
  `require_auth()` del comprador queda cubierto por la firma de la transacción.
  Se elimina `increaseMarketplaceAllowanceTx()`.
- **Sin `transfer_from`** (exigiría `approve` con `expiration_ledger`).
- El comprador es la **source account** → `require_auth` se resuelve con credenciales
  `SOURCE_ACCOUNT`, sin firmar auth entries por separado.
- Respuesta del backend: `{ xdr, network_passphrase, valid_until }` (reemplaza `{txs:[{tx,tx_type}]}`).
- El callback recibe **el XDR firmado**, no un tx hash. El backend hace fee-bump, submit
  y polling de `getTransaction`; el hash sale del submit.
- `delivery_fee` viaja dentro del mismo entrypoint: se cobra junto al total.

**Criterios de aceptación**
- [ ] Compra de 1 ítem sin envío: estado y montos idénticos a los de arriba.
- [ ] Compra de N ítems con envío a domicilio: `IN_DELIVERY` + `Delivery.paymentTxHash`.
- [ ] Reintento con el mismo XDR/hash → 400 `TX_HASH_ALREADY_USED`.
- [ ] Comprador **sin XLM** completa la compra (fee-bump del backend).
- [ ] `producerClaimBalance` == `items × price/1.5` (fee de mercado 5 000 bps intacto).
- [ ] Medido por simulación: máximo de ítems que caben en el presupuesto de recursos,
      y ese límite aplicado en el carrito.

---

## 2. Deploy de producto y su callback

### Hoy

| | |
|---|---|
| **Endpoints** | `POST /api/products/deploy` → `POST /api/products/deploy/callback` |
| **Entradas** | `initialStock`, `price` (USD), `product_id`; del token: `walletAddress`, `is_roaster` |
| **Resolución de productor** | Si `is_roaster`, `associated_producer` = wallet del dueño de la finca; si no, el propio caller |
| **Llamada al contrato** | `marketplace.create_product(initial_stock, price_usdc, associated_producer, short_description)` — `short_description` es el `product.id` truncado a 30 bytes en felt252 |
| **Reglas del contrato** | `initial_stock > 0`, `initial_stock ≤ 1000`, caller debe tener rol PRODUCER o ROASTER; mintea `initial_stock` NFTs 1155; `price_with_fee = price + fee(5 000 bps)` |
| **Respuesta** | `{ transaction: {contract_address, entrypoint, calldata}, type }` |
| **Eventos verificados** | `verifyCreateProductTx`: existe `CreateProduct`; `owner` == wallet del caller (403 `OWNER_MISMATCH`); `initial_stock` parseable (400 `INVALID_STOCK`) |
| **Guardas** | `product.ownerId == callerId` (403); `tx_hash` no repetido (409 `DUPLICATE_TX_HASH`) |
| **Muta en Postgres** | `ProductTx{productId, txType: CREATE, senderId, txHash}`; `Product.tokenId`, `Product.price` (= **precio con fee**, leído del evento), `Product.currentStock = initialStock`; `Product.status = PUBLISHED`; notificación `PRODUCT_DEPLOYMENT_SUCCESSFUL`; creación de producto Stripe (best-effort) |
| **Respuesta callback** | `{ product_id, tx_hash, token_id, price, initial_stock }` |

### Mañana

- `create_product` **ya no mintea**: solo registra el producto con su stock inicial en storage.
- Se conserva `token_id` como identificador on-chain (`Product.tokenId` en Postgres no se toca).
- `short_description`: pasa de `felt252` a `String`/`Symbol` de Soroban con el `product.id`.
- Eventos con topics legibles; `verifyCreateProductTx` conserva su lógica de validación,
  solo cambia la fuente (`getTransaction → resultMetaXdr → scValToNative`).
- Se elimina el paso Stripe (Fase 5).

**Criterios de aceptación**
- [ ] Productor publica; `Product.tokenId`, `price` (con fee) y `currentStock` quedan iguales.
- [ ] Tostador publica con `associated_producer` = wallet del dueño de la finca.
- [ ] Owner mismatch → 403; tx repetido → 409.
- [ ] `initial_stock` 0 o > 1000 → rechazo del contrato.

---

## 3. Ajuste de stock y sync

### Hoy

| | |
|---|---|
| **Endpoints** | `POST /api/products/:id/stock` → `POST /api/products/:id/stock/sync` |
| **Entradas** | `currentStock` (objetivo) |
| **Lógica** | Si `status == CREATION_REQUEST`: solo actualiza Postgres, devuelve `{tx:null, txType:null}`. Si no: lee `get_product(tokenId).stock` on-chain. Si `stockOnChain < objetivo` → `add_stock(token_id, objetivo - stockOnChain)` (mintea 1155). Si no → baja el stock solo en Postgres |
| **Reglas del contrato** | `owner == caller`, `amount > 0`, `amount ≤ 1000`, `is_available` |
| **Respuesta** | `{ tx, txType }` |
| **Sync** | Relee `get_product().stock`; si difiere de `currentStock` y `≥ reservedStock`, escribe `Product.currentStock`. Si `stockOnChain < reservedStock` → 500 `PRODUCT_STOCK_LESS_THAN_RESERVED_STOCK` |
| **Muta en Postgres** | `Product.currentStock` |

### Mañana

- `add_stock` es un incremento de contador en storage; sin mint.
- `get_product` devuelve la struct con `i128`/`u32` nativos (sin `low`/`high`).
- Respuesta pasa a `{ xdr, network_passphrase, valid_until }`; `null` cuando no hace falta tx.
- Debe extender TTL de la entrada de storage del producto en cada escritura.

**Criterios de aceptación**
- [ ] Subir stock de producto publicado genera tx y, tras sync, Postgres == on-chain.
- [ ] Bajar stock no genera tx y solo toca Postgres.
- [ ] Producto en `CREATION_REQUEST` nunca genera tx.
- [ ] Sync con `stockOnChain < reservedStock` sigue devolviendo 500.
- [ ] Producto archivado (TTL vencido) → error de dominio claro, no un fallo opaco de RPC.

---

## 4. Claim de saldo del vendedor

### Hoy

| | |
|---|---|
| **Endpoints** | `GET /api/sells/claim_balance`, `GET /api/sells/claim` → `POST /api/sells/claim/callback` |
| **Lectura** | `marketplace.get_seller_balance(wallet)` (string en unidades USDC) |
| **Llamada al contrato** | `marketplace.withdraw_seller_balance()` — transfiere el saldo acumulado al caller y lo pone en 0 |
| **Callback** | Relee `get_seller_balance(wallet)`; si **no** es `'0'` → 500 `CLAIM_BALANCE_NOT_0` |
| **Muta en Postgres** | `cleanProducerClaimBalance(userId, txHash)`: pone a 0 el `producerClaimBalance` de los `OrderItem` del vendedor |

### Mañana

- Firma pública de `OnChainBalancesService.claimSellerPayments()` / `getClaimBalance()` se conserva.
- **Trustline:** si el vendedor no tiene trustline a USDC el pago falla y el saldo queda
  atrapado en el contrato. Verificar trustline al asignar rol de vendedor y ofrecer crearla
  patrocinada antes de que publique su primer producto.

**Criterios de aceptación**
- [ ] Vendedor con saldo reclama y recibe USDC; `producerClaimBalance` queda en 0.
- [ ] Vendedor sin trustline recibe un error accionable **antes** de firmar, no un fallo de tx.
- [ ] Callback con saldo distinto de 0 sigue devolviendo 500.

---

## 5. Asignación de rol PRODUCER / ROASTER

### Hoy

| | |
|---|---|
| **Endpoint** | `POST /api/users/:id/seller_type` (admin) |
| **Entradas** | `sellerType: PRODUCER \| ROASTER \| null` |
| **Llamada al contrato** | `marketplace.assign_role(role, wallet)` — **firmada por la cuenta del backend** (`MAINNET_ACCOUNT_ADDR`), no por el usuario. Requiere `DEFAULT_ADMIN_ROLE` |
| **Verificación** | Espera 5 s fijos y comprueba que el recibo no sea error. *(No verifica el evento `AssignedRole`; hay un TODO en el código.)* |
| **Respuesta** | `{ user, tx_hash }` |
| **Muta en Postgres** | `User.sellerType` |

### Mañana

- Misma semántica de roles: PRODUCER, ROASTER, CAMBIATUS, COFIBLOCKS, COFOUNDER, CONSUMER.
- El backend sigue siendo el firmante (cuenta admin del contrato).
- **Mejora incluida:** verificar el evento `assign_role` en vez de solo el éxito del recibo.
- **Añadido:** comprobar trustline USDC del vendedor y ofrecer creación patrocinada.
- El rol `CONSUMER` se sigue asignando dentro de `buy_products` (de él depende
  `withdraw_distribution_balance` del coffee lover).

**Criterios de aceptación**
- [ ] Asignar PRODUCER/ROASTER surte efecto on-chain y `account_has_role` lo confirma.
- [ ] Revocar (`account_revoke_role`) funciona.
- [ ] Comprar asigna CONSUMER al comprador si no lo tenía.

---

## 6. Consulta de balances

### Hoy

| | |
|---|---|
| **Endpoint** | `GET /api/onchain/balance_of?wallet=` |
| **Devuelve** | `{ wallet, balances: { STRK, USDC, USDT, USDC_BRIDGED } }` (strings en unidades mínimas) |
| **Contrato** | `balance_of(wallet)` en cada ERC-20 |

### Mañana

- **Solo XLM y USDC.** Desaparecen STRK, USDT y USDC_BRIDGED.
- Nueva forma: `{ wallet, balances: { XLM, USDC }, trustlines: { USDC: boolean } }`.
  *(Es un cambio de shape explícito; obliga a tocar `useBalances`, `BalancesSection`,
  `TokenMenu` y `TransferModal` — ya previsto en Fase 6.)*
- Balance USDC vía SAC `balance(addr)`; balance XLM vía Horizon/RPC de la cuenta.

**Criterios de aceptación**
- [ ] Perfil muestra XLM y USDC correctos.
- [ ] Cuenta sin trustline USDC reporta balance 0 y `trustlines.USDC == false` sin romper.

---

## 7. Retiro a dirección externa

| | Hoy | Mañana |
|---|---|---|
| **Endpoint** | `POST /api/onchain/withdraw` | igual |
| **Entradas** | `token`, `amount` (`^\d+(\.\d{1,2})?$`), `withdrawAddress` (regex Starknet `0x`+64 hex) | `token ∈ {XLM, USDC}`, `amount`, `withdrawAddress` (**StrKey `G…`**) |
| **Guarda** | No se puede retirar a la propia dirección (400) | igual |
| **Contrato** | `ERC20.transfer(recipient, amount)` | `SAC.transfer(from, to, amount)` / pago clásico para XLM |
| **Postgres** | nada | nada |

- [ ] Regex de dirección cambiada a StrKey; direcciones `C…` (smart wallets) rechazadas con error claro.

---

## 8. Login por firma de wallet

### Hoy

| | |
|---|---|
| **Endpoint** | `POST /api/auth/register_wallet` |
| **Entradas** | `address`, `signature[]`, `nonce`, `provider` |
| **Nonce** | ⚠️ **Lo genera el cliente** (`Date.now()-random` en `webapp/utils/signature.ts`). El backend nunca lo emite ni lo invalida |
| **Verificación** | Typed data SNIP-12 (`domain: CofiBlocks/1/SN_MAIN\|SN_SEPOLIA`, `primaryType: Message`, campo `nonce`) → `typedData.getMessageHash` → `account.is_valid_signature(hash, sig)` **on-chain**, con 3 reintentos y 5 s de espera |
| **Muta en Postgres** | `User` (alta o login), `walletProvider ∈ {starknet, cavos}`, sesión + refresh token, notificación `welcome_message` si es alta |

### Mañana

- **`POST /auth/nonce`** (nuevo): emite nonce con TTL corto y consumo único.
  Se rechaza cualquier firma cuyo nonce no venga de ahí. *(Corrige el bug actual.)*
- Verificación **local**, sin red: formato **SEP-53** (prefijo `Stellar Signed Message:\n`
  + SHA-256) y `Keypair.fromPublicKey(address).verify(hash, signature)`.
- Se borran `backend/src/utils/starknet.ts` y `OnChainSignatureService.ts`
  (con sus reintentos por RPC).
- `walletProvider` pasa a `'stellar'`; se elimina la rama `'cavos'` en
  `UsersService.registerUser`, `routes/auth.ts` y `routes/config.ts`.
- **v1 solo cuentas clásicas `G…`.** Smart wallets y passkeys (`C…`) se rechazan con
  error claro.

**Criterios de aceptación**
- [ ] Login con Freighter y con xBull.
- [ ] Nonce reutilizado → rechazo.
- [ ] Nonce no emitido por el backend → rechazo.
- [ ] Nonce vencido → rechazo.
- [ ] Dirección `C…` → error claro, no un fallo genérico.
- [ ] Sesión, refresh y revocación se comportan igual que hoy.

---

## 9. Panel admin: información de contratos

| | Hoy | Mañana |
|---|---|---|
| **Endpoint** | `GET /api/onchain/contracts_info` (admin) | igual |
| **Devuelve** | `distribution{contractAddress,url,totalProfit,totalPurchases}`, `marketplace{contractAddress,url,usdcBalance}`, `cofiCollection{…}`, `swap{…,usdcBalance}` | **se caen `cofiCollection` y `swap`** |
| **Lectura de totales** | `readStorageAt` con selectores de storage hardcodeados (`0x01a31d9b…`, `0x0156264…`) | getters propios del contrato (`get_total_profit`, `get_total_purchases`) |
| **Explorer** | Voyager | Stellar Expert |

- [ ] `ContractsInfoResponse` en el frontend y el bloque de `admin/contracts/page.tsx` sin colección ni swap.
- [ ] Restauración de storage archivado expuesta desde el panel.

---

## 10. Reparto de utilidades (`distribution`)

### Hoy

| | |
|---|---|
| **`register_purchase`** | Invocado por el marketplace dentro de `buy_product`. Registra al coffee lover, al productor o al tostador (y a su productor asociado), acumula `total_purchases` y `total_profit` |
| **`distribute()`** | Solo admin. Itera **sin cota** sobre coffee lovers, productores y tostadores, reparte y resetea |
| **Porcentajes** | coffee lover 30 %, productor 30 %, tostador 5 %, Cambiatus 2 %, CofiBlocks 24 %, cofundadores 9 % |
| **Claims** | `withdraw_distribution_balance(role)` en el marketplace lee el balance del rol en distribution, transfiere USDC y resetea |

### Mañana

- **`distribute(cursor, limit)` paginado.** Los bucles sin cota no sobreviven a los
  límites duros de CPU/memoria/footprint de Soroban.
- **Porcentajes intactos.**
- `register_purchase` sigue siendo invocado por el marketplace (rol MARKETPLACE).
- Se elimina el `ERC1155Receiver`.

> **Este flujo nunca fue ejecutable desde la aplicación — ahora sí lo es.**
>
> En la versión Starknet el botón del panel era un `// TODO` que mostraba
> "coming soon" y no existía ninguna ruta (verificado contra el commit inicial).
> El contrato se portó con la migración; el cableado se agregó después.

**Cómo quedó**

| Pieza | Dónde |
|---|---|
| `POST /api/onchain/distribution/run` (admin) | Avanza el reparto de a páginas y devuelve `{done, pages, txHashes, run}` |
| `GET /api/onchain/distribution/claim_balance` | Saldos del usuario, uno por rol que tiene |
| `GET /api/onchain/distribution/claim?role=` | XDR para que el usuario firme su reclamo |
| `POST /api/onchain/distribution/claim/callback` | Envía el firmado y revalida que el saldo quedó en 0 |
| `OnChainDistributionService` | Bucle de paginación, validación de rol y de saldo |
| Panel admin | Llama en bucle hasta `done`, muestra avance y avisa si quedó un reparto a medias |
| `DistributionClaims` en el perfil | Aparece sólo si hay algo que cobrar; una fila por rol |

**Decisiones de diseño**

- **El progreso se relee de la cadena** (`get_run`) en vez de confiar en el valor
  de retorno del submit: es la misma fuente que el contrato usa para validar el
  cursor, así que no pueden desincronizarse.
- **5 páginas por request.** Cada página es una transacción confirmada, así que
  el corte es un presupuesto de tiempo contra el timeout del proxy. El frontend
  vuelve a llamar hasta terminar y el cursor vive en el contrato, así que un
  request cortado por el medio se retoma sin perder ni duplicar pagos.
- **Sólo CONSUMER, PRODUCER y ROASTER se reclaman desde la app.** Los roles
  institucionales (CAMBIATUS, COFIBLOCKS, COFOUNDER) se cobran fuera; el backend
  los rechaza con `ROLE_NOT_SELF_CLAIMABLE`.
- **El usuario firma su propio reclamo**: el contrato transfiere el USDC al
  `caller`, así que la autorización tiene que ser suya, no del backend.

**Criterios de aceptación**
- [ ] Con 3 coffee lovers, 2 productores y 1 tostador, el reparto da exactamente lo mismo
      que la implementación Cairo (test de referencia numérica).
- [ ] `distribute` paginado sobre una lista larga completa el reparto en varias llamadas
      sin exceder el presupuesto de recursos.
- [ ] Cada rol reclama su parte vía `withdraw_distribution_balance`.
- [ ] Un coffee lover que compró puede reclamar (depende del rol CONSUMER asignado en la compra).

---

## 11. Utilidad de testnet: mint de USDC

| | Hoy | Mañana |
|---|---|---|
| **Endpoint** | `GET /api/onchain/mint_sepolia_usdc` | renombrar a testnet |
| **Acción** | `USDC.mint(wallet, 100_000000)` (100 USD a 6 decimales) | USDC de testnet vía trustline + pago desde una cuenta de distribución del proyecto (el SAC de USDC de testnet no es minteable por nosotros) |

---

## Lo que se elimina (verificación de "cero referencias")

| Elemento | Motivo |
|---|---|
| Contrato `cofi_collection` + su test | Sin equivalente ERC-1155 en Soroban; se decidió no escribirlo |
| Contrato `swap` (Ekubo) + su test | Solo se paga en USDC |
| `mint_nfts` / `transfer_nfts` / `burn` en marketplace | Sin NFT de producto |
| `ERC1155Receiver` en marketplace y distribution | ídem |
| `get_tokens_by_holder` + `getTokensByHolder` | **Código muerto**: ninguna ruta ni servicio lo llama |
| `TOKEN_METADATA_URL`, base URI, metadata IPFS, `set_minter` | ídem |
| `CofiCollection.ts`, `getCofiCollectionAddress()`, campo `cofiCollection` | ídem |
| `OnChainSwapService.ts`, `/swap`, `/swap_price`, `useSwap`, `SwapModal` | ídem |
| `increaseMarketplaceAllowanceTx()` + patrón allowance | La autorización viaja por el árbol de invocación |
| `format_number()`, manejo `low`/`high` | `i128` nativo |
| Selectores de evento hardcodeados en `types/events.ts` | Topics legibles en Soroban |
| `OnChainSignatureService.ts`, `utils/starknet.ts` | Verificación ed25519 local |
| Cavos: `@cavos/react`, `useCavosLogin`, `useCavosSession`, `useOptionalCavos`, `CavosProvider`, `GET /api/config/cavos`, `getCavosConfig()` | Solo login por wallet |
| Stripe: `routes/stripe.ts`, `lib/Stripe/`, `services/stripe/`, `dbStripeProducts.ts`, modelo `StripeProduct`, `stripe_payment_id`, `payForOrderWithInternalWallet`, `processOrderStripePayment` | Solo pago en cripto |
| STRK, USDT, USDC.e en balances y `TokenMenu` | Solo USDC |
| `starknetkit` | Stellar Wallets Kit |

**Comando de verificación final:**

```bash
grep -riE "starknet|starknetkit|cavos|ekubo|stripe|erc1155" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git .
```

Debe devolver cero resultados.

---

## Riesgos con su verificación

| Riesgo | Cómo se verifica que está mitigado |
|---|---|
| La orden expira antes de que la tx confirme y el stock ya se liberó | Test: ledger bounds vencen **antes** que `Order.expiresAt` (10 min); el callback detecta orden cancelada con pago confirmado |
| Vendedor sin trustline USDC deja el saldo atrapado | Test: asignar rol a cuenta sin trustline → aviso; flujo de trustline patrocinada |
| `buy_products` con muchos ítems excede el presupuesto | Medir por simulación el máximo real y limitarlo en el carrito |
| State archival rompe operaciones sobre productos inactivos | Test: producto con TTL vencido → error de dominio; restauración desde admin |
| Retención de eventos en Soroban RPC (~7 días; transacciones bastante menos) | La verificación inmediata sigue sirviendo; cualquier reproceso tardío se apoya en Postgres |

---

## Definición de terminado (resumen ejecutable)

- [ ] Los 11 flujos de arriba pasan en testnet.
- [ ] Los 11 flujos de arriba pasan en mainnet con productos de prueba.
- [ ] `grep` de eliminaciones devuelve cero.
- [ ] La suite de contratos Soroban cubre al menos lo de `test_marketplace.cairo` (421 líneas)
      y `test_distribution.cairo` (393 líneas), **más casos de autorización reales**
      (no solo `mock_all_auths`).
- [ ] Usuario nuevo: conecta wallet → recibe trustline patrocinada → compra café en USDC
      **sin tener XLM**.
- [ ] Productor nuevo: recibe rol → publica producto → ajusta stock → reclama su pago en USDC.
- [ ] El panel admin ya no muestra colección ni swap, y el reparto se dispara paginado.

---

## Anexo A — despliegue de testnet (fase 2)

Desplegado y verificado punta a punta el 2026-09-02.

| | |
|---|---|
| Marketplace | `CC4HU6XKNG5PUYTNTTGCRGLGZG4X6FKUUHARA4GTKB4MKFK76KOOCEOG` |
| Distribution | `CAWOXN2MYZJWBDU6RCGIEB44W3LNIEPM66W6JQA6UUZ5KUBKKBHERSEB` |
| USDC de prueba (SAC) | `CDYIMMPF6SUKZWCHWIQ6ZGKYQ2KFOLUXL42Y5A6RWLMY7DB4RNVAHZJF` |
| Emisor del USDC de prueba | `GBKTOBQYPPUT2PC6YGVCEMPS5NXQ6K6I2Q5SIE6I56G7QT5CDGSTHSHF` |
| Fee de mercado | 5 000 bps |

En testnet no se usa el USDC de Circle: no lo podemos emitir. Se usa un activo
propio con los mismos 7 decimales. En mainnet se usa el USDC real.

Reproducir:

```bash
./scripts/setup-testnet.sh && ./contracts/scripts/deploy.sh testnet && ./contracts/scripts/e2e-testnet.sh
```

### Recorrido verificado on-chain

| Paso | Resultado |
|---|---|
| `assign_role(PRODUCER)` | evento `assign_role`, `account_has_role → true` |
| `create_product(50, 10 USDC)` | `token_id = 4`, `price_usdc_with_fee = 15 USDC` |
| `buy_products(3 uds, 2 USDC de envío)` | cobra exactamente 47 USDC (3 × 15 + 2) |
| stock y ventas | `stock 50 → 47`, `sells 0 → 3` |
| rol CONSUMER | otorgado al comprador en la misma transacción |
| `get_seller_balance` | 30 USDC (3 × 10, sin fee) |
| `withdraw_seller_balance` | el productor recibe 30 USDC |
| registro en distribution | `total_purchases = 45`, `total_profit = 15` |
| `distribute(0, 10)` | `done: true`, `processed: 3` en una sola página |
| claim del coffee lover | 4,5 USDC (30 % de 15) |
| claim del productor | 4,5 USDC (30 % de 15) |

### Medición de recursos de `buy_products`

Con soroban-sdk 27.0.6, contra los límites de mainnet protocolo 27:

| | 1 ítem | 16 ítems | por ítem | límite mainnet |
|---|---|---|---|---|
| eventos | 1 192 B | 9 352 B | +544 B | 16 384 B |
| entradas escritas | 14 | 29 | +1 | 200 |
| bytes escritos | 2 348 | 9 668 | +488 | 132 096 |
| footprint | 33 | 63 | +2 | 400 |

`MAX_ITEMS_PER_PURCHASE = 16`. El techo por tamaño de eventos rondaría los 28
ítems, pero 16 es el mayor tamaño que pasa el presupuesto que enforcea el
entorno de test. **Pendiente:** confirmarlo por simulación contra testnet con el
WASM desplegado, que es la única medición que incluye el costo de la VM.

---

## Anexo B — estado de las fases

| Fase | Estado | Verificación |
|---|---|---|
| 0 · Congelar el comportamiento | ✅ | Este documento + `scripts/verify-stellar-constants.mjs` |
| 1 · Contratos Soroban | ✅ | 59 tests, clippy y fmt limpios, compra completa en testnet |
| 2 · Deploy y scripts | ✅ | `deploy.sh` + `e2e-testnet.sh` reproducibles desde cero |
| 3 · Capa de cadena del backend | ✅ | `npm run test:chain` pasa contra testnet |
| 4 · Autenticación por wallet | ✅ | `POST /auth/nonce`, verificación SEP-53 local; falta probar con Freighter/xBull reales |
| 5 · Quitar Stripe | ✅ | Cero referencias funcionales; migración de Prisma escrita, **sin aplicar** |
| 6 · Frontend | ✅ | `next build` y `tsc` limpios; falta prueba manual con wallet real |
| 7 · Endurecer y salir | ⏳ | Código completo; falta ejecutar los flujos contra testnet y mainnet |

### Fase 7 — lo que ya está en código

| Item | Estado | Dónde |
|---|---|---|
| Ventana de firma acotada a lo que le queda a la orden | ✅ | `signingWindowForOrder()` en `OrdersService`: `min(restante − 60 s, 5 min)`, y `ORDER_EXPIRING_TOO_SOON` si queda menos de 60 s. La transacción ya no puede sobrevivir a la orden |
| Reconciliación de orden cancelada con pago confirmado | ✅ | 409 `ORDER_CANCELLED_WITH_CONFIRMED_PAYMENT` en `verifyOrderPayment` |
| Traducción de ambos códigos de error | ✅ | `api_errors` en es/en/pt |
| Extensión de TTL de storage | ✅ | `POST /api/onchain/product/:tokenId/touch` + `STATE_ARCHIVED` |
| Restauración expuesta en el panel admin | ✅ | `onchainService.touchProduct()` y sección en `admin/contracts` |
| Máximo de ítems medido y aplicado en el carrito | ✅ | `MAX_CART_ITEMS = 16` en `cartStore`, alineado con `MAX_ITEMS_PER_PURCHASE` del contrato; `addItem` devuelve `false` y la UI explica el motivo |
| Copy de wallets corregido | ✅ | ArgentX/Braavos (Starknet) → Freighter, xBull, Albedo, Lobstr |
| Reparto de utilidades cableado | ✅ | 4 rutas nuevas, `OnChainDistributionService`, panel admin y `DistributionClaims` en el perfil. Ver flujo 10 |
| `.env.example` completo | ✅ | Faltaban `BACKEND_URL`, `ALLOW_CROSS_DOMAIN_COOKIES`, `ADMIN_EMAILS` y las tres de Supabase |

### Fase 7 — lo que falta, y por qué no se puede cerrar desde el código

| Item | Qué requiere |
|---|---|
| Aplicar la migración de Prisma | Acceso a la base: `npm run prisma:migrate:deploy` |
| Login con Freighter y xBull reales | Navegador con la extensión instalada y una cuenta con fondos |
| Los 11 flujos en testnet | Claves de testnet y la migración aplicada |
| Los 11 flujos en mainnet | Cuenta de servicio con XLM para fee-bump y patrocinio |

### Lo que verifica `backend/npm run test:chain`

Ejercita la capa de cadena completa contra testnet, sin base de datos:

```
STELLAR_NETWORK=testnet \
STELLAR_ADMIN_SECRET=$(stellar keys show cofi-admin) \
PRODUCER_SECRET=$(stellar keys show cofi-producer) \
BUYER_SECRET=$(stellar keys show cofi-buyer) \
npm run test:chain
```

| Paso | Qué prueba |
|---|---|
| balances + trustline | Horizon para XLM, SAC para USDC, trustline detectada |
| `createProductTx` → firma → submit | `TxBuilder`, fee-bump de `TxSubmitter`, evento verificado (precio con fee 10 → 15 USDC) |
| `addProductStock` | Incremento de contador, sin mint |
| `buyProductsTx` → firma → submit | Cobra exactamente 47 USDC (3 × 15 + 2 de envío) |
| `verifyBuyProductEvents` | Topics legibles, sin selectores hexadecimales |
| `verifyDeliveryPayment` | Vía el evento `buy_batch`, sin sumar `transfer` del SAC |
| `claimSellerPayments` | El vendedor cobra y su saldo queda en 0 |
| `getStadisticsInContracts` | Sin `cofiCollection` ni `swap` |

### Cambios de forma en la API

| Endpoint | Antes | Ahora |
|---|---|---|
| `POST /api/orders/checkout` | `{ txs: [{tx, tx_type}], checkoutUrl }` | `{ xdr, network_passphrase, valid_until }` |
| `POST /api/orders/checkout/callback` | `{ id, tx_hash }` | `{ id, signed_xdr }` |
| `POST /api/products/deploy` | `{ transaction, type }` | `{ xdr, network_passphrase, valid_until }` |
| `POST /api/products/deploy/callback` | `{ product_id, tx_hash }` | `{ product_id, signed_xdr }` |
| `PATCH /api/products/:id/stock` | `{ tx, txType }` | `{ tx: PreparedTransaction \| null }` |
| `GET /api/products/:id/stock/sync` | sincroniza | ídem; el envío pasa a `POST /:id/stock/callback` |
| `GET /api/sells/claim` | `{ tx, txType }` | `{ xdr, network_passphrase, valid_until }` |
| `POST /api/sells/claim/callback` | `{ tx_hash }` | `{ signed_xdr }` |
| `POST /api/onchain/withdraw` | `{ tx, tx_type }` | `{ xdr, network_passphrase, valid_until }` |
| `GET /api/onchain/balance_of` | `{ STRK, USDC, USDT, USDC_BRIDGED }` | `{ balances: {XLM, USDC}, trustlines: {USDC} }` |
| `GET /api/config/cavos` | config de Cavos | **borrado** → `GET /api/config/stellar` |
| `POST /api/auth/register_wallet` | `signature: string[]`, `provider` | `signature: string` (SEP-53 base64), sin `provider` |
| — | — | **nuevo** `POST /api/auth/nonce` |
| — | — | **nuevo** `GET /api/onchain/usdc_trustline` + `/callback` |
| — | — | **nuevo** `POST /api/onchain/product/:tokenId/touch` (TTL) |
| `GET /api/onchain/swap_price`, `POST /swap`, `GET /mint_sepolia_usdc` | — | **borrados** |
