#!/usr/bin/env bash
# Despliega los contratos de CofiBlocks en Stellar.
#
#   ./contracts/scripts/deploy.sh testnet
#   ./contracts/scripts/deploy.sh mainnet
#
# Deja `contracts/deployments/<network>.json` con el mismo formato que ya
# consume `getContractAddress()` en el backend.
#
# Se acabaron los pasos de la versión Starknet: no hay `set_minter`, ni base URI,
# ni TOKEN_METADATA_URL — no hay colección de NFT que configurar.
set -euo pipefail

NETWORK="${1:-testnet}"
ADMIN="${STELLAR_ADMIN_IDENTITY:-cofi-admin}"
# Fee de mercado en basis points. 5 000 bps = 50 %, igual que en producción.
MARKET_FEE="${MARKET_FEE_BPS:-5000}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/deployments"
WASM_DIR="$ROOT/target/wasm32v1-none/release"

case "$NETWORK" in
  testnet)
    PASSPHRASE="Test SDF Network ; September 2015"
    RPC_URL="${STELLAR_RPC_URL_TESTNET:-https://soroban-testnet.stellar.org}"
    # En testnet usamos un USDC propio: el de Circle no lo podemos emitir.
    USDC_ISSUER="${USDC_ISSUER:-$(stellar keys address cofi-usdc-issuer)}"
    ;;
  mainnet)
    PASSPHRASE="Public Global Stellar Network ; September 2015"
    RPC_URL="${STELLAR_RPC_URL_MAINNET:-https://mainnet.sorobanrpc.com}"
    # USDC de Circle. Verificado: 7 decimales (scripts/verify-stellar-constants.mjs).
    USDC_ISSUER="${USDC_ISSUER:-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN}"
    ;;
  *)
    echo "red desconocida: $NETWORK (usar testnet o mainnet)"; exit 1;;
esac

NET_ARGS=(--network-passphrase "$PASSPHRASE" --rpc-url "$RPC_URL")
USDC_ASSET="USDC:${USDC_ISSUER}"
ADMIN_ADDRESS="$(stellar keys address "$ADMIN")"

echo "red        $NETWORK"
echo "admin      $ADMIN ($ADMIN_ADDRESS)"
echo "fee        ${MARKET_FEE} bps"
echo ""

echo "→ build"
(cd "$ROOT" && stellar contract build >/dev/null)

USDC_SAC="$(stellar contract id asset --asset "$USDC_ASSET" "${NET_ARGS[@]}")"
echo "→ USDC SAC $USDC_SAC"

echo "→ distribution"
DIST_HASH="$(stellar contract upload \
  --wasm "$WASM_DIR/distribution.wasm" \
  --source-account "$ADMIN" "${NET_ARGS[@]}" 2>/dev/null)"
DIST_ID="$(stellar contract deploy \
  --wasm-hash "$DIST_HASH" \
  --source-account "$ADMIN" "${NET_ARGS[@]}" \
  -- --admin "$ADMIN_ADDRESS" 2>/dev/null)"
echo "   $DIST_ID"

echo "→ marketplace"
MKT_HASH="$(stellar contract upload \
  --wasm "$WASM_DIR/marketplace.wasm" \
  --source-account "$ADMIN" "${NET_ARGS[@]}" 2>/dev/null)"
MKT_ID="$(stellar contract deploy \
  --wasm-hash "$MKT_HASH" \
  --source-account "$ADMIN" "${NET_ARGS[@]}" \
  -- \
  --distribution "$DIST_ID" \
  --usdc "$USDC_SAC" \
  --admin "$ADMIN_ADDRESS" \
  --market_fee "$MARKET_FEE" 2>/dev/null)"
echo "   $MKT_ID"

echo "→ enlazando distribution con marketplace"
stellar contract invoke \
  --id "$DIST_ID" --source-account "$ADMIN" "${NET_ARGS[@]}" \
  -- set_marketplace --marketplace "$MKT_ID" >/dev/null

mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/${NETWORK}.json"
cat > "$OUT" <<JSON
{
  "network": "$NETWORK",
  "networkPassphrase": "$PASSPHRASE",
  "rpcUrl": "$RPC_URL",
  "Distribution": {
    "contract": "Distribution",
    "address": "$DIST_ID",
    "wasmHash": "$DIST_HASH"
  },
  "Marketplace": {
    "contract": "Marketplace",
    "address": "$MKT_ID",
    "wasmHash": "$MKT_HASH",
    "marketFeeBps": $MARKET_FEE
  },
  "USDC": {
    "contract": "USDC",
    "address": "$USDC_SAC",
    "issuer": "$USDC_ISSUER",
    "decimals": 7
  }
}
JSON

echo ""
echo "✅ $OUT"
cat "$OUT"
