import { BatchStage, Prisma, StaffRole } from '@prisma/client';

import { MAX_WEIGHT_KG } from '@/config/pilot';
import { HttpException } from '@/exceptions/HttpException';
import { STAGES } from '@/lib/StellarContracts/types';
import type { PreparedTransaction } from '@/lib/StellarContracts/types/transactions';
import { addressVal, bytes32Val, stageVal, stringVal } from '@/lib/StellarContracts/utils/scval';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { batchUpdatedData } from '@/services/app/DeliveriesService';
import { explorerTxUrl } from '@/services/app/FarmerDataService';
import { buildFarmerRef } from '@/services/app/FarmersService';
import { enqueueWebhook } from '@/services/app/WebhooksService';
import * as OnChainTraceabilityService from '@/services/onchain/OnChainTraceabilityService';
import { asStaffSigned, ensureOnChain, transactionPending } from '@/services/onchain/ensureOnChain';
import { sha256Canonical } from '@/utils/canonicalJson';

// ── rules (the same as the contract's `Stage::allows` and `Stage::can_follow`) ──

const STAGE_ORDER = Object.values(BatchStage);

/** Who can move a batch to each stage with `advance_stage`. */
const STAGE_ROLES: Partial<Record<BatchStage, StaffRole[]>> = {
  WASHING: [StaffRole.INDUSTRY_MANAGER],
  FERMENTATION: [StaffRole.INDUSTRY_MANAGER],
  DRYING: [StaffRole.INDUSTRY_MANAGER],
  STORAGE: [StaffRole.INDUSTRY_MANAGER, StaffRole.STORE_KEEPER],
  IN_TRANSPORT_TO_UNION: [StaffRole.STORE_KEEPER],
  PREPARED_WITH_EXPORTABLE_BAG: [StaffRole.EXPORT_MANAGER],
  SOLD: [StaffRole.EXPORT_MANAGER],
};

/** The stages that can come right after `stage`. Fermentation is optional until Ethiopia confirms it. */
export function nextStages(stage: BatchStage): BatchStage[] {
  const next = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
  const result = next ? [next] : [];
  if (stage === BatchStage.WASHING) result.push(BatchStage.DRYING);
  return result;
}

export function roleAllows(role: StaffRole | null | undefined, stage: BatchStage): boolean {
  return !!role && !!STAGE_ROLES[stage]?.includes(role);
}

/** Stages from which `role` can move a batch forward (the batches waiting for them). */
export function stagesActionableBy(role: StaffRole | null | undefined): BatchStage[] {
  return STAGE_ORDER.filter((stage) => nextStages(stage).some((next) => roleAllows(role, next)));
}

/** The Export Manager works at union level: any cooperative. Everyone else, their own. */
export function worksOnOrganization(user: { role: StaffRole | null; organizationId: string | null }, organizationId: string) {
  return user.role === StaffRole.EXPORT_MANAGER || user.organizationId === organizationId;
}

/** Stages this user can move this batch to now (empty if none). */
export function allowedNextStages(
  user: { role: StaffRole | null; organizationId: string | null; walletAddress: string | null } | null,
  batch: { stage: BatchStage; organizationId: string; createdOnChainAt: Date | null }
): BatchStage[] {
  if (!user?.walletAddress || !batch.createdOnChainAt || !worksOnOrganization(user, batch.organizationId)) return [];
  return nextStages(batch.stage).filter((stage) => roleAllows(user.role, stage));
}

// ── advance a stage ─────────────────────────────────────────────────────────

export interface StageInput {
  batchId: string;
  stage: BatchStage;
  notes?: string | null;
  /** Weight after this stage, in kg (optional: e.g. after drying or bagging). */
  weightKg?: number | null;
}

/** What is stored while the transaction is in flight, to finish it on any later call. */
interface PendingStage {
  record: ReturnType<typeof stageRecord>;
  dataHash: string;
  actor: string;
  actorUserId: string;
}

/** The stage record whose SHA-256 goes on chain as `data_hash`. */
function stageRecord(batchNumber: string, actor: string, input: StageInput) {
  return {
    batch_id: batchNumber,
    stage: input.stage,
    actor,
    weight_kg: input.weightKg ?? null,
    notes: input.notes?.trim() || null,
  };
}

async function load(userId: string, input: StageInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.walletAddress) throw new HttpException(400, 'User has no wallet', 'USER_WITHOUT_WALLET');
  if (!roleAllows(user.role, input.stage)) {
    throw new HttpException(403, `Your role cannot move a batch to ${input.stage}`, 'UNAUTHORIZED');
  }
  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    include: {
      collectionCenter: true,
      organization: { select: { code: true } },
      farmer: { select: { coopFarmerId: true } },
    },
  });
  if (!batch) throw new HttpException(404, 'Batch not found', 'BATCH_NOT_FOUND');
  if (!worksOnOrganization(user, batch.organizationId)) {
    throw new HttpException(403, 'The batch belongs to another cooperative', 'WRONG_ORGANIZATION');
  }
  if (input.weightKg != null && (!Number.isFinite(input.weightKg) || input.weightKg <= 0 || input.weightKg > MAX_WEIGHT_KG)) {
    throw new HttpException(400, `Weight must be between 0 and ${MAX_WEIGHT_KG} kg`, 'INVALID_WEIGHT');
  }
  const record = stageRecord(batch.number, user.walletAddress, {
    ...input,
    weightKg: input.weightKg != null ? Math.round(input.weightKg * 1000) / 1000 : null,
  });
  const dataHash = sha256Canonical(record);
  return { user, wallet: user.walletAddress, batch, record, dataHash };
}

function checkTransition(batch: { stage: BatchStage; createdOnChainAt: Date | null }, stage: BatchStage) {
  if (!batch.createdOnChainAt) throw new HttpException(409, 'The batch is not on chain yet', 'BATCH_NOT_ON_CHAIN');
  if (!nextStages(batch.stage).includes(stage)) {
    throw new HttpException(409, `A batch in ${batch.stage} cannot move to ${stage}`, 'INVALID_TRANSITION', {
      stage: batch.stage,
    });
  }
}

/** Step 1: checks the request and returns the `advance_stage` transaction to sign. */
export async function prepareStage(
  userId: string,
  input: StageInput
): Promise<{ prepared: PreparedTransaction; data_hash: string }> {
  const { batch, wallet, dataHash } = await load(userId, input);
  checkTransition(batch, input.stage);
  const prepared = await OnChainTraceabilityService.prepareAdvanceStage(wallet, batch.number, input.stage as STAGES, dataHash);
  return { prepared, data_hash: dataHash };
}

export interface StageResult {
  batch_id: string;
  stage: BatchStage;
  data_hash: string;
  tx_hash: string;
  explorer_url: string;
}

/**
 * Step 2: checks the signed transaction is exactly the prepared call, sends it
 * with fee-bump (exactly once, like the reception), checks the event and
 * stores the step. VoiceLedger gets `batch.updated`.
 */
export async function submitStage(userId: string, input: StageInput, signedXdr: string): Promise<StageResult> {
  const { user, wallet, batch, record, dataHash } = await load(userId, input);
  OnChainTraceabilityService.assertStaffInvocation(signedXdr, wallet, 'advance_stage', [
    addressVal(wallet),
    stringVal(batch.number),
    stageVal(input.stage as STAGES),
    bytes32Val(dataHash),
  ]);
  const result = (txHash: string, stage: BatchStage, hash: string): StageResult => ({
    batch_id: batch.number,
    stage,
    data_hash: hash,
    tx_hash: txHash,
    explorer_url: explorerTxUrl(txHash),
  });

  // A retry of a step already stored gets its answer again.
  const done = await prisma.batchEvent.findFirst({ where: { batchId: batch.id, stage: input.stage, dataHash } });
  if (done) return result(done.txHash, done.stage, done.dataHash);
  // `batch.stage` only changes once a step is confirmed, so this holds even
  // with an earlier attempt still in flight (`ensureOnChain` settles it first).
  checkTransition(batch, input.stage);

  const pending: PendingStage = { record, dataHash, actor: wallet, actorUserId: user.id };
  const txHash = await ensureOnChain({
    label: `advance_stage ${batch.number} ${input.stage}`,
    state: { tx: batch.stageTx, txValidUntil: batch.stageTxValidUntil, confirmedAt: null },
    send: asStaffSigned(signedXdr),
    claim: async (previous, hash, validUntil) => {
      // Only from the stage we checked: two stage changes can never race.
      const { count } = await prisma.batch.updateMany({
        where: { id: batch.id, stage: batch.stage, stageTx: previous },
        data: { stageTx: hash, stageTxValidUntil: validUntil, stageTxData: pending as unknown as Prisma.InputJsonValue },
      });
      return count === 1;
    },
    release: async (hash) => {
      await prisma.batch.updateMany({
        where: { id: batch.id, stageTx: hash },
        data: { stageTx: null, stageTxValidUntil: null, stageTxData: Prisma.DbNull },
      });
    },
    confirm: (hash) => confirmStage(batch.id, hash),
    pending: transactionPending,
  });

  const event = await prisma.batchEvent.findUniqueOrThrow({ where: { txHash } });
  if (event.dataHash !== dataHash) {
    // An earlier, different stage change was still in flight and is what landed.
    throw new HttpException(409, `The batch moved to ${event.stage} in the meantime`, 'INVALID_TRANSITION', {
      stage: event.stage,
    });
  }
  logger.info({ batch: batch.number, stage: input.stage, txHash }, 'Advanced stage');
  return result(txHash, event.stage, event.dataHash);
}

/** Verifies the stored in-flight stage change on chain and records it. */
async function confirmStage(batchId: string, hash: string): Promise<void> {
  const batch = await prisma.batch.findUniqueOrThrow({
    where: { id: batchId },
    include: { collectionCenter: true, organization: { select: { code: true } }, farmer: { select: { coopFarmerId: true } } },
  });
  const existing = await prisma.batchEvent.findUnique({ where: { txHash: hash } });
  if (existing) return;
  if (batch.stageTx !== hash || !batch.stageTxData) {
    throw new HttpException(500, `No stored stage change for ${hash}`, 'STAGE_TX_UNKNOWN');
  }
  const pending = batch.stageTxData as unknown as PendingStage;
  const stage = pending.record.stage;
  await OnChainTraceabilityService.verifyStageAdvanced(hash, batch.number, stage as STAGES, pending.actor, pending.dataHash);

  const updatedAt = new Date();
  const farmerRef = buildFarmerRef(batch.organization.code, batch.farmer.coopFarmerId);
  await prisma.$transaction([
    prisma.batch.update({
      where: { id: batch.id },
      data: { stage, stageTx: null, stageTxValidUntil: null, stageTxData: Prisma.DbNull },
    }),
    prisma.batchEvent.create({
      data: {
        batchId: batch.id,
        stage,
        actorAddress: pending.actor,
        actorUserId: pending.actorUserId,
        data: pending.record,
        dataHash: pending.dataHash,
        txHash: hash,
      },
    }),
    enqueueWebhook(`batch.updated:${hash}`, 'batch.updated', batchUpdatedData({ ...batch, stage, updatedAt }, farmerRef, hash)),
  ]);
}
