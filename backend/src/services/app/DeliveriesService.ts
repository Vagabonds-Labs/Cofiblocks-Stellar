import { BatchStage, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';

import { MAX_DELIVERY_AGE_DAYS, MAX_ESTIMATED_KG, PILOT_TIME_ZONE } from '@/config/pilot';
import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { DeliveryCreatedData } from '@/schemas/integrationSchemas';
import {
  explorerTxUrl,
  findRegisteredFarmer,
  IntegrationContext,
  isUniqueViolation,
  requireConsent,
} from '@/services/app/FarmerDataService';
import { enqueueWebhook } from '@/services/app/WebhooksService';
import * as OnChainTraceabilityService from '@/services/onchain/OnChainTraceabilityService';
import { asFarmerAgent, ensureOnChain, transactionPending } from '@/services/onchain/ensureOnChain';
import { sha256Canonical } from '@/utils/canonicalJson';

/** The contract's limit for batch IDs. */
const MAX_BATCH_ID_LEN = 64;

/** Further deliveries of a farmer on the same day: `/2` … `/MAX_SAME_DAY`. */
const MAX_SAME_DAY = 50;

/** How much a delivery date may be ahead of our clock. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface DeliveryRecordInput {
  number: string;
  farmerRef: string;
  coopCode: string;
  centerName: string;
  centerChainId: number;
  deliveredAt: Date;
  estimatedKg: number | null;
  ripeness: string | null;
  /** Collector-recorded deliveries: the weight the farmer confirmed. */
  weightKg?: number;
  /** Collector-recorded deliveries: the proposal the farmer confirmed. */
  proposalId?: string;
}

/**
 * The delivery record whose SHA-256 goes on chain with `create_batch`. Every
 * field comes from the `Batch` row (and its proposal), so the hash can always
 * be recomputed. `weight_kg` and `proposal_id` only exist for deliveries a
 * Collector recorded; they are left out (not `null`) otherwise, so older
 * batches keep their hash.
 */
export function deliveryRecord(batch: DeliveryRecordInput) {
  return {
    batch_id: batch.number,
    farmer_ref: batch.farmerRef,
    coop_code: batch.coopCode,
    collection_center: batch.centerName,
    collection_center_id: batch.centerChainId,
    delivered_at: batch.deliveredAt.toISOString(),
    estimated_kg: batch.estimatedKg,
    ripeness: batch.ripeness,
    weight_kg: batch.weightKg,
    proposal_id: batch.proposalId,
  };
}

/** `DD-MM-YYYY <farmer_ref>` for the first delivery of the day, then `/2`, `/3`… */
export function batchNumber(deliveredAt: Date, farmerRef: string, sequence: number): string {
  const day = DateTime.fromJSDate(deliveredAt).setZone(PILOT_TIME_ZONE).toFormat('dd-MM-yyyy');
  const base = `${day} ${farmerRef}`;
  return sequence === 1 ? base : `${base}/${sequence}`;
}

/** Checks a delivery date: not in the future, not older than the pilot allows. */
export function checkDeliveryDate(date: Date, field = 'occurred_at'): Date {
  const now = Date.now();
  if (date.getTime() > now + CLOCK_SKEW_MS) {
    throw new HttpException(422, `${field} is in the future`, 'INVALID_DELIVERY_DATE');
  }
  if (date.getTime() < now - MAX_DELIVERY_AGE_DAYS * 24 * 3600 * 1000) {
    throw new HttpException(422, `${field} is more than ${MAX_DELIVERY_AGE_DAYS} days ago`, 'INVALID_DELIVERY_DATE');
  }
  return date;
}

const batchWithCenter = { collectionCenter: true } satisfies Prisma.BatchInclude;
type BatchWithCenter = Prisma.BatchGetPayload<{ include: typeof batchWithCenter }>;

/**
 * Creates the `Batch` row for a delivery with the next free number of that
 * day. Idempotent: `existing` finds the row a previous attempt created (by
 * its integration event or its proposal), and `uniqueField` is the column
 * that makes a concurrent duplicate fail.
 */
async function allocateBatch(params: {
  farmerRef: string;
  coopCode: string;
  center: { id: string; name: string; chainId: number };
  deliveredAt: Date;
  record: Omit<DeliveryRecordInput, 'number' | 'farmerRef' | 'coopCode' | 'centerName' | 'centerChainId' | 'deliveredAt'>;
  data: Omit<Prisma.BatchUncheckedCreateInput, 'number' | 'dataHash' | 'collectionCenterId' | 'deliveredAt'>;
  existing: () => Promise<BatchWithCenter | null>;
  uniqueField: string;
}): Promise<BatchWithCenter> {
  const { farmerRef, coopCode, center, deliveredAt } = params;
  for (let sequence = 1; sequence <= MAX_SAME_DAY; sequence++) {
    const number = batchNumber(deliveredAt, farmerRef, sequence);
    if (number.length > MAX_BATCH_ID_LEN) {
      throw new HttpException(422, `Batch number ${number} is too long`, 'INVALID_BATCH_ID');
    }
    if (await prisma.batch.findUnique({ where: { number }, select: { id: true } })) continue;
    // The chain outlives test databases: never reuse a number it already has.
    if (await OnChainTraceabilityService.findBatch(number)) continue;

    const dataHash = sha256Canonical(
      deliveryRecord({
        number,
        farmerRef,
        coopCode,
        centerName: center.name,
        centerChainId: center.chainId,
        deliveredAt,
        ...params.record,
      })
    );
    try {
      return await prisma.batch.create({
        data: { ...params.data, number, collectionCenterId: center.id, deliveredAt, dataHash },
        include: batchWithCenter,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (isUniqueViolation(error, params.uniqueField)) {
        const row = await params.existing();
        if (row) return row;
      }
      // Otherwise another delivery took this number: try the next one.
    }
  }
  throw new HttpException(422, `Too many deliveries for ${farmerRef} on the same day`, 'TOO_MANY_DELIVERIES');
}

/** What `batch.updated` tells VoiceLedger about a batch. */
export function batchUpdatedData(batch: {
  number: string;
  stage: BatchStage;
  updatedAt: Date;
  weightGrams: bigint | null;
  collectionCenter: { name: string };
}, farmerRef: string, txHash: string, proposalKg?: number | null) {
  return {
    batch_id: batch.number,
    farmer_ref: farmerRef,
    stage: batch.stage,
    collection_center: batch.collectionCenter.name,
    weight_kg: batch.weightGrams !== null ? Number(batch.weightGrams) / 1000 : (proposalKg ?? null),
    updated_at: batch.updatedAt.toISOString(),
    tx_hash: txHash,
    explorer_url: explorerTxUrl(txHash),
  };
}

/**
 * Writes the batch on chain with `create_batch`, signed by the farmer agent:
 * the SOW proof "a farmer creates a batch". Exactly once (see
 * `ensureOnChain`); the confirmation also stores the `DELIVERED` step and
 * tells VoiceLedger (`batch.updated`).
 */
async function recordBatchOnChain(row: BatchWithCenter, farmerRef: string, record: ReturnType<typeof deliveryRecord>) {
  const center = row.collectionCenter;
  return ensureOnChain({
    label: `create_batch ${row.number}`,
    state: { tx: row.createTx, txValidUntil: row.createTxValidUntil, confirmedAt: row.createdOnChainAt },
    send: asFarmerAgent(OnChainTraceabilityService.build.createBatch(row.number, farmerRef, center.chainId, row.dataHash)),
    claim: async (previous, hash, validUntil) => {
      const { count } = await prisma.batch.updateMany({
        where: { id: row.id, createdOnChainAt: null, createTx: previous },
        data: { createTx: hash, createTxValidUntil: validUntil },
      });
      return count === 1;
    },
    release: async (hash) => {
      await prisma.batch.updateMany({
        where: { id: row.id, createTx: hash, createdOnChainAt: null },
        data: { createTx: null, createTxValidUntil: null },
      });
    },
    confirm: async (hash) => {
      await OnChainTraceabilityService.verifyBatchCreated(hash, row.number, farmerRef, center.chainId, row.dataHash);
      const now = new Date();
      await prisma.$transaction([
        prisma.batch.update({
          where: { id: row.id },
          data: { createTx: hash, createdOnChainAt: now, createTxValidUntil: null },
        }),
        prisma.batchEvent.upsert({
          where: { txHash: hash },
          create: {
            batchId: row.id,
            stage: BatchStage.DELIVERED,
            actorAddress: OnChainTraceabilityService.getFarmerAgentAddress(),
            data: record,
            dataHash: row.dataHash,
            txHash: hash,
          },
          update: {},
        }),
        enqueueWebhook(
          `batch.updated:${hash}`,
          'batch.updated',
          batchUpdatedData({ ...row, updatedAt: now }, farmerRef, hash, record.weight_kg)
        ),
      ]);
    },
    pending: transactionPending,
  });
}

function recordFor(row: BatchWithCenter, farmerRef: string, coopCode: string, extra: { weightKg?: number; proposalId?: string } = {}) {
  return deliveryRecord({
    number: row.number,
    farmerRef,
    coopCode,
    centerName: row.collectionCenter.name,
    centerChainId: row.collectionCenter.chainId,
    deliveredAt: row.deliveredAt,
    estimatedKg: row.estimatedKg !== null ? Number(row.estimatedKg) : null,
    ripeness: row.ripeness,
    ...extra,
  });
}

export interface DeliveryResult {
  batch_id: string;
  farmer_ref: string;
  collection_center: string;
  estimated_kg: number | null;
  ripeness: string | null;
  delivered_at: string;
  stage: 'DELIVERED';
  data_hash: string;
  tx_hash: string;
  explorer_url: string;
}

/**
 * `delivery.created`: a delivery the farmer reported in the bot. Not part of
 * the pilot's flow any more (deliveries come from the Collector, see
 * `DeliveryProposalsService`), but kept for the simulator and as a fallback.
 */
export async function createDelivery(ctx: IntegrationContext, data: DeliveryCreatedData): Promise<DeliveryResult> {
  const farmer = await findRegisteredFarmer(data.farmer_ref);
  const { farmerRef } = farmer;
  const coop = farmer.organization;
  const existing = () =>
    prisma.batch.findUnique({ where: { integrationEventId: ctx.integrationEventId }, include: batchWithCenter });

  let batch = await existing();
  if (!batch) {
    requireConsent(farmer, farmerRef);

    const center = coop.collectionCenters.find(
      (c) => c.name.toLowerCase() === data.collection_center.toLowerCase()
    );
    if (!center) {
      throw new HttpException(
        422,
        `${data.collection_center} is not a collection center of ${coop.code}`,
        'UNKNOWN_COLLECTION_CENTER',
        { valid: coop.collectionCenters.map((c) => c.name) }
      );
    }
    if (data.estimated_kg != null && data.estimated_kg > MAX_ESTIMATED_KG) {
      throw new HttpException(
        422,
        `estimated_kg is above ${MAX_ESTIMATED_KG} kg. Ask the farmer to confirm the quantity.`,
        'ESTIMATED_KG_TOO_HIGH'
      );
    }
    const deliveredAt = ctx.occurredAt ? checkDeliveryDate(ctx.occurredAt) : new Date();
    // Rounded to what the database keeps, so the hash can be recomputed from it.
    const estimatedKg = data.estimated_kg != null ? Math.round(data.estimated_kg * 100) / 100 : null;
    const ripeness = data.ripeness ? data.ripeness.toLowerCase() : null;

    batch = await allocateBatch({
      farmerRef,
      coopCode: coop.code,
      center,
      deliveredAt,
      record: { estimatedKg, ripeness },
      data: {
        farmerId: farmer.id,
        organizationId: coop.id,
        integrationEventId: ctx.integrationEventId,
        estimatedKg,
        ripeness,
        transcript: data.transcript ?? null,
        audioRef: data.audio_ref ?? null,
      },
      existing,
      uniqueField: 'integration_event_id',
    });
  }

  const record = recordFor(batch, farmerRef, coop.code);
  const txHash = await recordBatchOnChain(batch, farmerRef, record);

  logger.info({ batch: batch.number, farmerRef, txHash }, 'Recorded delivery on chain');
  return {
    batch_id: batch.number,
    farmer_ref: farmerRef,
    collection_center: batch.collectionCenter.name,
    estimated_kg: record.estimated_kg,
    ripeness: batch.ripeness,
    delivered_at: record.delivered_at,
    stage: 'DELIVERED',
    data_hash: batch.dataHash,
    tx_hash: txHash,
    explorer_url: explorerTxUrl(txHash),
  };
}

/**
 * The batch of a delivery the farmer confirmed (`delivery.confirmation`):
 * creates it once per proposal and writes it on chain, signed by the farmer
 * agent. Returns the batch and its transaction.
 */
export async function createBatchFromProposal(
  proposal: {
    id: string;
    farmerId: string;
    organizationId: string;
    deliveredAt: Date;
    weightKg: number;
    transcript: string | null;
    audioRef: string | null;
    collectionCenter: { id: string; name: string; chainId: number };
  },
  farmerRef: string,
  coopCode: string,
  integrationEventId: string
) {
  const existing = () =>
    prisma.batch.findUnique({ where: { deliveryProposalId: proposal.id }, include: batchWithCenter });
  const extra = { weightKg: proposal.weightKg, proposalId: proposal.id };

  const batch =
    (await existing()) ??
    (await allocateBatch({
      farmerRef,
      coopCode,
      center: proposal.collectionCenter,
      deliveredAt: proposal.deliveredAt,
      record: { estimatedKg: null, ripeness: null, ...extra },
      data: {
        farmerId: proposal.farmerId,
        organizationId: proposal.organizationId,
        deliveryProposalId: proposal.id,
        integrationEventId,
        transcript: proposal.transcript,
        audioRef: proposal.audioRef,
      },
      existing,
      uniqueField: 'delivery_proposal_id',
    }));

  const record = recordFor(batch, farmerRef, coopCode, extra);
  const txHash = await recordBatchOnChain(batch, farmerRef, record);
  logger.info({ batch: batch.number, farmerRef, proposalId: proposal.id, txHash }, 'Recorded confirmed delivery on chain');
  return { batch, txHash, record };
}
