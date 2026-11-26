-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "stage_tx" TEXT,
ADD COLUMN     "stage_tx_data" JSONB,
ADD COLUMN     "stage_tx_valid_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "tx_valid_until" TIMESTAMP(3);
