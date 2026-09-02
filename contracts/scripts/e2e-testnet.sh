#!/usr/bin/env bash
# Recorrido completo del flujo de venta contra testnet, desde la CLI.
#
#   ./contracts/scripts/e2e-testnet.sh
#
# Es el criterio de salida de la fase 1: rol → publicar → comprar → cobrar,
# todo on-chain y con los saldos verificados.
set -euo pipefail

NETWORK="testnet"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY="$ROOT/deployments/${NETWORK}.json"
[ -f "$DEPLOY" ] || { echo "falta $DEPLOY — correr deploy.sh primero"; exit 1; }

# Lee una clave del JSON de despliegue: cfg Marketplace address | cfg rpcUrl
cfg() {
  python3 -c 'import json,sys
d = json.load(open(sys.argv[1]))
for k in sys.argv[2:]:
    d = d[k]
print(d)' "$DEPLOY" "$@"
}
MKT="$(cfg Marketplace address)"
DIST="$(cfg Distribution address)"
USDC="$(cfg USDC address)"
PASSPHRASE="$(cfg networkPassphrase)"
RPC_URL="$(cfg rpcUrl)"

NET=(--network-passphrase "$PASSPHRASE" --rpc-url "$RPC_URL")
PRODUCER="$(stellar keys address cofi-producer)"
BUYER="$(stellar keys address cofi-buyer)"

# El CLI serializa los enum de contrato como enteros: ver `--role <0 | 1 | ...>`.
ROLE_PRODUCER=0
ROLE_CONSUMER=5

mkt()  { stellar contract invoke --id "$MKT"  --source-account "$1" "${NET[@]}" -- "${@:2}"; }
dist() { stellar contract invoke --id "$DIST" --source-account "$1" "${NET[@]}" -- "${@:2}"; }
usdc_balance() {
  stellar contract invoke --id "$USDC" --source-account cofi-admin "${NET[@]}" \
    --send=no -- balance --id "$1" 2>/dev/null | tr -d '"'
}

echo "marketplace  $MKT"
echo "distribution $DIST"
echo "usdc         $USDC"
echo ""

echo "① rol PRODUCER para el productor"
mkt cofi-admin assign_role --role "$ROLE_PRODUCER" --assignee "$PRODUCER" >/dev/null
echo "   account_has_role → $(mkt cofi-admin account_has_role --role "$ROLE_PRODUCER" --account "$PRODUCER" 2>/dev/null)"

echo ""
echo "② publicar un producto: 50 de stock a 10 USDC"
TOKEN_ID="$(mkt cofi-producer create_product \
  --seller "$PRODUCER" \
  --initial_stock 50 \
  --price 100000000 \
  --short_description '"cafe-de-prueba"' 2>/dev/null | tr -d '"')"
echo "   token_id = $TOKEN_ID"
# u128 viaja como string en el JSON del CLI; u32 como número.
mkt cofi-admin get_product --token_id "$TOKEN_ID" 2>/dev/null

BUYER_ANTES="$(usdc_balance "$BUYER")"
echo ""
echo "③ comprar 3 unidades con 2 USDC de envío"
echo "   saldo del comprador antes: $BUYER_ANTES"
mkt cofi-buyer buy_products \
  --buyer "$BUYER" \
  --token_ids "[\"$TOKEN_ID\"]" \
  --amounts '[3]' \
  --delivery_fee 20000000 >/dev/null
BUYER_DESPUES="$(usdc_balance "$BUYER")"
echo "   saldo del comprador después: $BUYER_DESPUES"
echo "   pagado: $(( BUYER_ANTES - BUYER_DESPUES )) (esperado 470000000 = 3 × 15 USDC + 2 USDC)"
[ $(( BUYER_ANTES - BUYER_DESPUES )) -eq 470000000 ] || { echo "   ✗ el cobro no coincide"; exit 1; }

echo ""
echo "   stock y ventas tras la compra:"
mkt cofi-admin get_product --token_id "$TOKEN_ID" 2>/dev/null
echo "   rol CONSUMER del comprador → $(mkt cofi-admin account_has_role --role "$ROLE_CONSUMER" --account "$BUYER" 2>/dev/null)"

echo ""
echo "④ saldo acumulado del vendedor"
SALDO="$(mkt cofi-admin get_seller_balance --wallet_address "$PRODUCER" 2>/dev/null | tr -d '"')"
echo "   get_seller_balance = $SALDO (esperado 300000000 = 3 × 10 USDC sin fee)"
[ "$SALDO" = "300000000" ] || { echo "   ✗ el saldo no coincide"; exit 1; }

PROD_ANTES="$(usdc_balance "$PRODUCER")"
mkt cofi-producer withdraw_seller_balance --seller "$PRODUCER" >/dev/null
PROD_DESPUES="$(usdc_balance "$PRODUCER")"
echo "   cobrado: $(( PROD_DESPUES - PROD_ANTES ))"
[ $(( PROD_DESPUES - PROD_ANTES )) -eq 300000000 ] || { echo "   ✗ el cobro no coincide"; exit 1; }

echo ""
echo "⑤ el reparto quedó registrado en distribution"
echo "   total_purchases = $(dist cofi-admin get_total_purchases 2>/dev/null)"
echo "   total_profit    = $(dist cofi-admin get_total_profit 2>/dev/null)"

echo ""
echo "⑥ reparto paginado"
dist cofi-admin distribute --cursor 0 --limit 10 2>/dev/null
echo "   saldo del coffee lover = $(dist cofi-admin coffee_lover_claim_balance --address "$BUYER" 2>/dev/null)"
echo "   saldo del productor    = $(dist cofi-admin producer_claim_balance --address "$PRODUCER" 2>/dev/null)"

echo ""
echo "⑦ el coffee lover reclama su parte"
CL_ANTES="$(usdc_balance "$BUYER")"
mkt cofi-buyer withdraw_distribution_balance --caller "$BUYER" --role "$ROLE_CONSUMER" >/dev/null
CL_DESPUES="$(usdc_balance "$BUYER")"
echo "   reclamado: $(( CL_DESPUES - CL_ANTES ))"
[ $(( CL_DESPUES - CL_ANTES )) -gt 0 ] || { echo "   ✗ no reclamó nada"; exit 1; }

echo ""
echo "✅ recorrido completo en testnet"
