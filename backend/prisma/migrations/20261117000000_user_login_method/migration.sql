-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "login_identity" TEXT,
ADD COLUMN     "login_method" TEXT,
ADD COLUMN     "wallet_app" TEXT;

-- Accounts created with an own wallet before this column existed.
UPDATE "users" SET "login_method" = 'wallet' WHERE "wallet_provider" IS DISTINCT FROM 'cavos' AND "login_method" IS NULL;
