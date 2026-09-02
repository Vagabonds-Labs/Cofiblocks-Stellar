-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_stripe_payment_id_fkey";

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "stripe_payment_id" TYPE TEXT USING "stripe_payment_id"::TEXT;
