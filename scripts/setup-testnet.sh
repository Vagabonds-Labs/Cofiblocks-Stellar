#!/usr/bin/env bash
# Entorno de testnet reproducible para la migración a Stellar.
#
#   ./scripts/setup-testnet.sh
#
# Crea (o reutiliza) las identidades del proyecto, las fondea con friendbot y
# emite un USDC de prueba con 7 decimales — los mismos que el USDC real de
# mainnet. Idempotente.
#
# En testnet no se usa el USDC de Circle porque no lo podemos emitir: se usa un
# activo propio emitido por `cofi-usdc-issuer`. En mainnet se usa el USDC real
# (ver docs/parity-checklist.md § 0).
set -euo pipefail

NETWORK="testnet"
RPC_URL="${STELLAR_RPC_URL_TESTNET:-https://soroban-testnet.stellar.org}"
PASSPHRASE="Test SDF Network ; September 2015"

# admin       → despliega los contratos, es admin y paga los fee-bumps
# producer    → publica productos y cobra en USDC
# roaster     → tostador, publica con productor asociado
# buyer       → compra café
# usdc-issuer → emisor del USDC de prueba
IDENTITIES=(cofi-admin cofi-producer cofi-roaster cofi-buyer cofi-usdc-issuer)
HOLDERS=(cofi-admin cofi-producer cofi-roaster cofi-buyer)

command -v stellar >/dev/null || {
  echo "falta el CLI 'stellar' — cargo install --locked stellar-cli"; exit 1;
}
echo "CLI: $(stellar --version | head -1)"

stellar network add "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASSPHRASE" 2>/dev/null || true

echo ""
echo "→ identidades"
for id in "${IDENTITIES[@]}"; do
  if ! stellar keys address "$id" >/dev/null 2>&1; then
    stellar keys generate "$id" --network "$NETWORK" --fund >/dev/null
  fi
  # Fondear de nuevo es idempotente: si ya tiene saldo, friendbot falla y seguimos.
  stellar keys fund "$id" --network "$NETWORK" >/dev/null 2>&1 || true
  printf '  %-18s %s\n' "$id" "$(stellar keys address "$id")"
done

ISSUER=$(stellar keys address cofi-usdc-issuer)
USDC_ASSET="USDC:${ISSUER}"

echo ""
echo "→ trustlines a $USDC_ASSET"
for id in "${HOLDERS[@]}"; do
  stellar tx new change-trust \
    --source-account "$id" --network "$NETWORK" \
    --line "$USDC_ASSET" >/dev/null 2>&1 || true
  printf '  %-18s ✓\n' "$id"
done

echo ""
echo "→ fondeo de USDC de prueba (10 000 por cuenta)"
for id in "${HOLDERS[@]}"; do
  stellar tx new payment \
    --source-account cofi-usdc-issuer --network "$NETWORK" \
    --destination "$(stellar keys address "$id")" \
    --asset "$USDC_ASSET" --amount 100000000000 >/dev/null 2>&1 || true
  printf '  %-18s ✓\n' "$id"
done

echo ""
echo "→ SAC del USDC de prueba"
USDC_SAC=$(stellar contract id asset --asset "$USDC_ASSET" --network "$NETWORK")
if stellar contract info interface --id "$USDC_SAC" --network "$NETWORK" >/dev/null 2>&1; then
  echo "  ya desplegado"
else
  stellar contract asset deploy \
    --asset "$USDC_ASSET" --source-account cofi-admin --network "$NETWORK" >/dev/null
  echo "  desplegado"
fi

cat <<SUMMARY

Constantes de testnet
  passphrase   $PASSPHRASE
  rpc          $RPC_URL
  USDC issuer  $ISSUER
  USDC SAC     $USDC_SAC

Siguiente paso:
  ./contracts/scripts/deploy.sh testnet
SUMMARY
