-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "stripe_payment_id" UUID;

-- CreateTable
CREATE TABLE "stripe_products" (
    "id" UUID NOT NULL,
    "stripe_product_id" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "stripe_price_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_products_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_stripe_payment_id_fkey" FOREIGN KEY ("stripe_payment_id") REFERENCES "stripe_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_products" ADD CONSTRAINT "stripe_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
