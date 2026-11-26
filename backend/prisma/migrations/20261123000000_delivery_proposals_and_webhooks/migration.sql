-- CreateEnum
CREATE TYPE "DeliveryProposalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "delivery_proposal_id" TEXT;

-- CreateTable
CREATE TABLE "delivery_proposals" (
    "id" TEXT NOT NULL,
    "farmer_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "collection_center_id" TEXT NOT NULL,
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL,
    "status" "DeliveryProposalStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "answer_event_id" TEXT,
    "answered_at" TIMESTAMP(3),
    "transcript" TEXT,
    "audio_ref" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_notifications" (
    "id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_proposals_answer_event_id_key" ON "delivery_proposals"("answer_event_id");

-- CreateIndex
CREATE INDEX "delivery_proposals_organization_id_status_idx" ON "delivery_proposals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "delivery_proposals_farmer_id_status_idx" ON "delivery_proposals"("farmer_id", "status");

-- CreateIndex
CREATE INDEX "delivery_proposals_status_expires_at_idx" ON "delivery_proposals"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_notifications_dedupe_key_key" ON "webhook_notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "webhook_notifications_status_next_attempt_at_idx" ON "webhook_notifications"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "batches_delivery_proposal_id_key" ON "batches"("delivery_proposal_id");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_delivery_proposal_id_fkey" FOREIGN KEY ("delivery_proposal_id") REFERENCES "delivery_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proposals" ADD CONSTRAINT "delivery_proposals_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proposals" ADD CONSTRAINT "delivery_proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proposals" ADD CONSTRAINT "delivery_proposals_collection_center_id_fkey" FOREIGN KEY ("collection_center_id") REFERENCES "collection_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proposals" ADD CONSTRAINT "delivery_proposals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proposals" ADD CONSTRAINT "delivery_proposals_answer_event_id_fkey" FOREIGN KEY ("answer_event_id") REFERENCES "integration_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Like every other table: reachable only through the backend, never through
-- Supabase's public API.
ALTER TABLE "delivery_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_notifications" ENABLE ROW LEVEL SECURITY;
