-- Migración a Stellar: se elimina Stripe y se agrega el nonce de login.

-- Solo se paga en cripto: Stripe se va entero.
ALTER TABLE "orders" DROP COLUMN IF EXISTS "stripe_payment_id";
DROP TABLE IF EXISTS "stripe_products";

-- Nonce de login por firma de wallet: TTL corto y consumo único.
-- Antes lo generaba el cliente y el backend nunca lo invalidaba.
CREATE TABLE "auth_nonces" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "wallet_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_nonces_nonce_key" ON "auth_nonces"("nonce");
CREATE INDEX "auth_nonces_expires_at_idx" ON "auth_nonces"("expires_at");

-- Arranque en frío: no se migran productos ni saldos desde Starknet. Los
-- registros existentes se marcan como legacy y se filtran del catálogo; no se
-- borran ni se les pisa el estado.
ALTER TABLE "products" ADD COLUMN "legacy" BOOLEAN NOT NULL DEFAULT false;
UPDATE "products" SET "legacy" = true WHERE "token_id" IS NOT NULL AND "token_id" <> '';
