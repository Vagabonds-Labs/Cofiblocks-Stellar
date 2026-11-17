import { BatchStage, Prisma } from '@prisma/client';

import { HttpException } from '@/exceptions/HttpException';
import { prisma } from '@/lib/prisma';
import { buildFarmerRef } from '@/services/app/FarmersService';
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

export async function listBatches(
  _viewer: Viewer,
  filters: { stage?: BatchStage; collectionCenterId?: string; organizationId?: string; search?: string; limit: number; offset: number }
) {
  const base: Prisma.BatchWhereInput = {
    // A delivery whose transaction is not confirmed yet is not a batch yet.
    createdOnChainAt: { not: null },
    ...(filters.organizationId && { organizationId: filters.organizationId }),
    ...(filters.collectionCenterId && { collectionCenterId: filters.collectionCenterId }),
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

/** A batch with its history. Each step says whether its hash still matches the stored record. */
export async function getBatch(_viewer: Viewer, id: string) {
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      ...batchInclude,
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actorUser: { select: { name: true, role: true } } },
      },
    },
  });
  if (!batch) {
    throw new HttpException(404, 'Batch not found', 'BATCH_NOT_FOUND');
  }
  return {
    ...toDto(batch),
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
        weightKg: event.batch.weightGrams !== null ? Number(event.batch.weightGrams) / 1000 : null,
      },
    })),
  };
}

export const BATCH_STAGES = Object.values(BatchStage);
