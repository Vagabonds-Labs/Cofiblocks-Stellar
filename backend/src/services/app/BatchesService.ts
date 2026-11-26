import { BatchStage, Prisma } from '@prisma/client';

import { HttpException } from '@/exceptions/HttpException';
import { isSameAddress } from '@/lib/StellarContracts/utils';
import { prisma } from '@/lib/prisma';
import { toDocumentDto } from '@/services/app/DocumentsService';
import { buildFarmerRef } from '@/services/app/FarmersService';
import { allowedNextStages, stagesActionableBy } from '@/services/app/StagesService';
import * as OnChainTraceabilityService from '@/services/onchain/OnChainTraceabilityService';
import { sha256Canonical } from '@/utils/canonicalJson';

/** Who is asking, as `authenticate` leaves it in `req.user`. */
export interface Viewer {
  userId: string;
  isAdmin: boolean;
}

/**
 * Every signed-in user can read every batch: what is shown is pseudonymous
 * (farmer_ref, centers, stages, kg, hashes) and already public on Stellar.
 * Only the actions are restricted by role.
 */
const batchInclude = {
  farmer: { select: { coopFarmerId: true } },
  organization: { select: { id: true, code: true, name: true } },
  collectionCenter: { select: { id: true, name: true } },
  deliveryProposal: { select: { weightKg: true } },
} satisfies Prisma.BatchInclude;

type BatchRow = Prisma.BatchGetPayload<{ include: typeof batchInclude }>;

/** What the web app gets for a batch. Only pseudonymous IDs: no names. */
function toDto(batch: BatchRow) {
  return {
    id: batch.id,
    number: batch.number,
    stage: batch.stage,
    farmerRef: buildFarmerRef(batch.organization.code, batch.farmer.coopFarmerId),
    organization: batch.organization,
    collectionCenter: batch.collectionCenter,
    deliveredAt: batch.deliveredAt.toISOString(),
    estimatedKg: batch.estimatedKg !== null ? Number(batch.estimatedKg) : null,
    ripeness: batch.ripeness,
    /** Weight the Collector recorded at delivery and the farmer confirmed in the bot. */
    confirmedKg: batch.deliveryProposal ? Number(batch.deliveryProposal.weightKg) : null,
    weightKg: batch.weightGrams !== null ? Number(batch.weightGrams) / 1000 : null,
    receiptHash: batch.receiptHash,
    receivedAt: batch.receivedAt?.toISOString() ?? null,
    dataHash: batch.dataHash,
    createTx: batch.createdOnChainAt ? batch.createTx : null,
    receptionTx: batch.receivedAt ? batch.receptionTx : null,
    onChain: !!batch.createdOnChainAt,
  };
}

export type BatchDto = ReturnType<typeof toDto>;

export interface BatchFilters {
  stage?: BatchStage;
  collectionCenterId?: string;
  organizationId?: string;
  search?: string;
  /** Only the batches the viewer's role can move forward now. */
  forMe?: boolean;
}

/** Batches waiting for the viewer: the stages their role continues from, in their cooperative (any, for the Export Manager). */
async function forMeFilter(viewer: Viewer): Promise<Prisma.BatchWhereInput> {
  const user = await prisma.user.findUnique({ where: { id: viewer.userId }, select: { role: true, organizationId: true } });
  const stages = stagesActionableBy(user?.role);
  if (!user?.role || stages.length === 0) return { id: { in: [] } };
  return {
    stage: { in: stages },
    ...(user.role !== 'EXPORT_MANAGER' && { organizationId: user.organizationId ?? '' }),
  };
}

async function batchWhere(viewer: Viewer, filters: BatchFilters) {
  const base: Prisma.BatchWhereInput = {
    // A delivery whose transaction is not confirmed yet is not a batch yet.
    createdOnChainAt: { not: null },
    ...(filters.organizationId && { organizationId: filters.organizationId }),
    ...(filters.collectionCenterId && { collectionCenterId: filters.collectionCenterId }),
    ...(filters.forMe && (await forMeFilter(viewer))),
  };
  const where: Prisma.BatchWhereInput = {
    ...base,
    ...(filters.stage && { stage: filters.stage }),
    ...(filters.search && {
      OR: [
        { number: { contains: filters.search, mode: 'insensitive' } },
        { farmer: { coopFarmerId: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
  };
  return { base, where };
}

export async function listBatches(viewer: Viewer, filters: BatchFilters & { limit: number; offset: number }) {
  const { base, where } = await batchWhere(viewer, filters);

  const [total, batches, byStage] = await Promise.all([
    prisma.batch.count({ where }),
    prisma.batch.findMany({
      where,
      include: batchInclude,
      orderBy: [{ deliveredAt: 'desc' }, { number: 'desc' }],
      take: filters.limit,
      skip: filters.offset,
    }),
    // Counts per stage ignore the stage filter, so the chips show every stage.
    prisma.batch.groupBy({ by: ['stage'], where: base, _count: { _all: true } }),
  ]);
  return {
    total,
    batches: batches.map(toDto),
    stageCounts: Object.fromEntries(byStage.map((s) => [s.stage, s._count._all])) as Partial<Record<BatchStage, number>>,
  };
}

/**
 * A batch with its history and documents. Each step says whether its hash
 * still matches the stored record; `nextStages` are the stages the viewer can
 * move it to now, and `canAttach` whether they can attach documents.
 */
export async function getBatch(viewer: Viewer, id: string) {
  const [batch, user] = await Promise.all([
    prisma.batch.findUnique({
      where: { id },
      include: {
        ...batchInclude,
        events: {
          orderBy: { createdAt: 'asc' },
          include: { actorUser: { select: { name: true, role: true } } },
        },
        documents: {
          orderBy: { createdAt: 'asc' },
          include: { uploadedBy: { select: { name: true, role: true } } },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: viewer.userId },
      select: { id: true, role: true, organizationId: true, walletAddress: true },
    }),
  ]);
  if (!batch) {
    throw new HttpException(404, 'Batch not found', 'BATCH_NOT_FOUND');
  }
  const canAttach =
    !!batch.createdOnChainAt &&
    !!user?.role &&
    !!user.walletAddress &&
    (user.role === 'EXPORT_MANAGER' || user.organizationId === batch.organizationId);
  return {
    ...toDto(batch),
    nextStages: allowedNextStages(user, batch),
    stageInFlight: !!batch.stageTx,
    canAttach,
    // Attached ones for everybody; one still unsigned only for whoever uploaded it.
    documents: batch.documents
      .filter((doc) => doc.attachedAt || doc.uploadedById === viewer.userId)
      .map(toDocumentDto),
    events: batch.events.map((event) => ({
      stage: event.stage,
      actorAddress: event.actorAddress,
      actor: event.actorUser ? { name: event.actorUser.name, role: event.actorUser.role } : null,
      data: event.data,
      dataHash: event.dataHash,
      // Recomputed from the stored record: if someone edited it, this is false.
      dataHashMatches: sha256Canonical(event.data) === event.dataHash,
      txHash: event.txHash,
      at: event.createdAt.toISOString(),
    })),
  };
}

/**
 * "Verified on Stellar": reads the batch from the contract and checks that
 * every stored step (its record's hash, stage and signer) and every attached
 * document is there, and that the stage matches.
 */
export async function verifyBatch(_viewer: Viewer, id: string) {
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: 'asc' } }, documents: { where: { attachedAt: { not: null } } } },
  });
  if (!batch) throw new HttpException(404, 'Batch not found', 'BATCH_NOT_FOUND');
  const chain = batch.createdOnChainAt ? await OnChainTraceabilityService.findBatch(batch.number) : null;

  const steps = batch.events.map((event) => {
    const recordMatches = sha256Canonical(event.data) === event.dataHash;
    const onChain = !!chain?.history.some(
      (r) => r.stage === event.stage && r.data_hash === event.dataHash && isSameAddress(r.actor, event.actorAddress)
    );
    return { stage: event.stage, txHash: event.txHash, recordMatches, onChain };
  });
  const documents = batch.documents.map((doc) => ({
    id: doc.id,
    sha256: doc.sha256,
    onChain: !!chain?.documents.includes(doc.sha256),
  }));
  const stageMatches = !!chain && chain.stage === batch.stage;
  const weightMatches = !chain || batch.weightGrams === null || chain.weight_grams === batch.weightGrams.toString();
  const verified =
    !!chain &&
    stageMatches &&
    weightMatches &&
    chain.history.length === steps.length &&
    steps.every((s) => s.recordMatches && s.onChain) &&
    documents.every((d) => d.onChain);

  return {
    verified,
    checkedAt: new Date().toISOString(),
    onChain: !!chain,
    stage: { stored: batch.stage, onChain: chain?.stage ?? null },
    stageMatches,
    weightMatches,
    steps,
    documents,
  };
}

const CSV_STAGES: BatchStage[] = Object.values(BatchStage).filter((s) => s !== BatchStage.DELIVERED);

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Quote when needed, and neutralize spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * The batches as CSV, one row per batch with the date and transaction of each
 * step. Only pseudonymous IDs, like the rest of the batch views.
 */
export async function exportBatchesCsv(viewer: Viewer, filters: BatchFilters): Promise<string> {
  const { where } = await batchWhere(viewer, filters);
  const batches = await prisma.batch.findMany({
    where,
    include: {
      ...batchInclude,
      events: { orderBy: { createdAt: 'asc' } },
      _count: { select: { documents: { where: { attachedAt: { not: null } } } } },
    },
    orderBy: [{ deliveredAt: 'desc' }, { number: 'desc' }],
    take: 5000,
  });

  const header = [
    'batch_id',
    'farmer_ref',
    'cooperative',
    'collection_center',
    'stage',
    'delivered_at',
    'confirmed_kg',
    'received_kg',
    'documents',
    'delivery_data_hash',
    'delivery_tx',
    ...CSV_STAGES.flatMap((s) => [`${s.toLowerCase()}_at`, `${s.toLowerCase()}_tx`]),
  ];
  const rows = batches.map((batch) => {
    const dto = toDto(batch);
    const step = (stage: BatchStage) => batch.events.find((e) => e.stage === stage);
    return [
      dto.number,
      dto.farmerRef,
      dto.organization.code,
      dto.collectionCenter.name,
      dto.stage,
      dto.deliveredAt,
      dto.confirmedKg,
      dto.weightKg,
      batch._count.documents,
      dto.dataHash,
      dto.createTx,
      ...CSV_STAGES.flatMap((s) => [step(s)?.createdAt.toISOString(), step(s)?.txHash]),
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Resolves a batch the viewer may see to its number (used by the reception routes). */
export async function getBatchNumber(viewer: Viewer, id: string): Promise<string> {
  return (await getBatch(viewer, id)).number;
}

/**
 * The pilot at a glance: farmers, batches, kg and the latest on-chain steps,
 * overall and per cooperative. Counts only confirmed on-chain records.
 */
export async function getSummary(_viewer: Viewer, recentLimit = 10) {
  const onChain = { createdOnChainAt: { not: null } } satisfies Prisma.BatchWhereInput;
  const [coops, farmersTotal, farmersLinked, farmersConsented, byStage, byCoop, weighed, recent] = await Promise.all([
    prisma.organization.findMany({ where: { kind: 'COOPERATIVE' }, select: { id: true, code: true, name: true, _count: { select: { collectionCenters: true } } }, orderBy: { chainId: 'asc' } }),
    prisma.farmer.groupBy({ by: ['organizationId'], _count: { _all: true } }),
    prisma.farmer.groupBy({ by: ['organizationId'], where: { registeredAt: { not: null } }, _count: { _all: true } }),
    prisma.farmer.count({ where: { consentAt: { not: null } } }),
    prisma.batch.groupBy({ by: ['organizationId', 'stage'], where: onChain, _count: { _all: true } }),
    prisma.batch.groupBy({ by: ['organizationId'], where: onChain, _count: { _all: true }, _sum: { weightGrams: true } }),
    prisma.batch.aggregate({ where: { ...onChain, weightGrams: { not: null } }, _sum: { weightGrams: true } }),
    prisma.batchEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: recentLimit,
      include: { batch: { include: batchInclude } },
    }),
  ]);

  const count = (rows: { organizationId: string; _count: { _all: number } }[], id: string) =>
    rows.find((r) => r.organizationId === id)?._count._all ?? 0;
  const gramsToKg = (grams: bigint | null | undefined) => (grams ? Number(grams) / 1000 : 0);
  const stageCounts: Partial<Record<BatchStage, number>> = {};
  for (const row of byStage) stageCounts[row.stage] = (stageCounts[row.stage] ?? 0) + row._count._all;

  return {
    farmers: {
      total: farmersTotal.reduce((sum, r) => sum + r._count._all, 0),
      linked: farmersLinked.reduce((sum, r) => sum + r._count._all, 0),
      consented: farmersConsented,
    },
    batches: {
      total: byStage.reduce((sum, r) => sum + r._count._all, 0),
      byStage: stageCounts,
    },
    receivedKg: gramsToKg(weighed._sum.weightGrams),
    cooperatives: coops.map((coop) => {
      const batches = byCoop.find((r) => r.organizationId === coop.id);
      return {
        id: coop.id,
        code: coop.code,
        name: coop.name,
        collectionCenters: coop._count.collectionCenters,
        farmers: count(farmersTotal, coop.id),
        farmersLinked: count(farmersLinked, coop.id),
        batches: batches?._count._all ?? 0,
        receivedKg: gramsToKg(batches?._sum.weightGrams),
        byStage: Object.fromEntries(byStage.filter((r) => r.organizationId === coop.id).map((r) => [r.stage, r._count._all])) as Partial<Record<BatchStage, number>>,
      };
    }),
    recent: recent.map((event) => ({
      stage: event.stage,
      at: event.createdAt.toISOString(),
      txHash: event.txHash,
      batch: {
        id: event.batch.id,
        number: event.batch.number,
        farmerRef: buildFarmerRef(event.batch.organization.code, event.batch.farmer.coopFarmerId),
        organization: event.batch.organization,
        collectionCenter: event.batch.collectionCenter,
        estimatedKg: event.batch.estimatedKg !== null ? Number(event.batch.estimatedKg) : null,
        confirmedKg: event.batch.deliveryProposal ? Number(event.batch.deliveryProposal.weightKg) : null,
        weightKg: event.batch.weightGrams !== null ? Number(event.batch.weightGrams) / 1000 : null,
      },
    })),
  };
}

export const BATCH_STAGES = Object.values(BatchStage);
