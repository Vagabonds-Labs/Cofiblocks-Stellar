import { DeliveryProposalStatus, Prisma, StaffRole } from '@prisma/client';

import { MAX_WEIGHT_KG, PROPOSAL_TTL_HOURS } from '@/config/pilot';
import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { DeliveryConfirmationData } from '@/schemas/integrationSchemas';
import { checkDeliveryDate, createBatchFromProposal } from '@/services/app/DeliveriesService';
import { explorerTxUrl, findRegisteredFarmer, IntegrationContext, requireConsent } from '@/services/app/FarmerDataService';
import { buildFarmerRef } from '@/services/app/FarmersService';
import { enqueueWebhook } from '@/services/app/WebhooksService';

/**
 * Deliveries in the pilot: the Collector records them in the web app (farmer,
 * center, weight, date), the farmer confirms or rejects them in the
 * VoiceLedger bot, and only a confirmation creates the batch on chain.
 * Contract with VoiceLedger: `docs/voiceledger-integration.md`, "Deliveries".
 */

const proposalInclude = {
  farmer: { select: { coopFarmerId: true, fullName: true } },
  organization: { select: { code: true } },
  collectionCenter: { select: { id: true, name: true, chainId: true } },
  batch: { select: { id: true, number: true, createTx: true, createdOnChainAt: true } },
} satisfies Prisma.DeliveryProposalInclude;

type ProposalRow = Prisma.DeliveryProposalGetPayload<{ include: typeof proposalInclude }>;

const kg = (value: Prisma.Decimal) => Number(value);

function farmerRefOf(proposal: ProposalRow) {
  return buildFarmerRef(proposal.organization.code, proposal.farmer.coopFarmerId);
}

/** What the web app shows. Staff of the cooperative see the farmer's name. */
function toDto(proposal: ProposalRow) {
  return {
    id: proposal.id,
    farmerRef: farmerRefOf(proposal),
    farmerName: proposal.farmer.fullName,
    collectionCenter: { id: proposal.collectionCenter.id, name: proposal.collectionCenter.name },
    weightKg: kg(proposal.weightKg),
    deliveredAt: proposal.deliveredAt.toISOString(),
    status: proposal.status,
    expiresAt: proposal.expiresAt.toISOString(),
    answeredAt: proposal.answeredAt?.toISOString() ?? null,
    createdAt: proposal.createdAt.toISOString(),
    batch: proposal.batch?.createdOnChainAt ? { id: proposal.batch.id, number: proposal.batch.number } : null,
  };
}

export type DeliveryProposalDto = ReturnType<typeof toDto>;

/** What `delivery.proposed` and the farmer's batches tell VoiceLedger. */
function proposalData(proposal: ProposalRow) {
  return {
    proposal_id: proposal.id,
    farmer_ref: farmerRefOf(proposal),
    collection_center: proposal.collectionCenter.name,
    weight_kg: kg(proposal.weightKg),
    delivered_at: proposal.deliveredAt.toISOString(),
    expires_at: proposal.expiresAt.toISOString(),
  };
}

async function collectorOf(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== StaffRole.COLLECTOR || !user.organizationId) {
    throw new HttpException(403, 'Only a Coffee Collector of a cooperative records deliveries', 'UNAUTHORIZED');
  }
  return { ...user, organizationId: user.organizationId };
}

/** Farmers of the Collector's cooperative, for the delivery form. */
export async function listFarmersForDelivery(userId: string, search?: string) {
  const user = await collectorOf(userId);
  const farmers = await prisma.farmer.findMany({
    where: {
      organizationId: user.organizationId,
      ...(search && {
        OR: [
          { coopFarmerId: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: { organization: { select: { code: true } } },
    orderBy: [{ fullName: 'asc' }, { coopFarmerId: 'asc' }],
    take: 50,
  });
  return farmers.map((f) => ({
    id: f.id,
    farmerRef: buildFarmerRef(f.organization.code, f.coopFarmerId),
    name: f.fullName,
    collectionCenterId: f.collectionCenterId,
    // The bot can only reach linked farmers, and deliveries need consent.
    linked: !!f.registeredAt && f.telegramUserId !== null,
    consented: !!f.consentAt,
  }));
}

export interface ProposeInput {
  farmerId: string;
  collectionCenterId?: string;
  weightKg: number;
  deliveredAt?: Date;
}

/**
 * The Collector records a delivery. It waits for the farmer's answer in the
 * bot: we enqueue `delivery.proposed` in the same transaction.
 */
export async function propose(userId: string, input: ProposeInput): Promise<DeliveryProposalDto> {
  const user = await collectorOf(userId);
  const farmer = await prisma.farmer.findUnique({
    where: { id: input.farmerId },
    include: { organization: { select: { code: true } } },
  });
  if (!farmer || farmer.organizationId !== user.organizationId) {
    throw new HttpException(404, 'No such farmer in your cooperative', 'FARMER_NOT_FOUND');
  }
  const farmerRef = buildFarmerRef(farmer.organization.code, farmer.coopFarmerId);
  if (!farmer.registeredAt || farmer.telegramUserId === null) {
    throw new HttpException(409, `${farmerRef} has not linked the bot yet, so they cannot confirm`, 'FARMER_NOT_LINKED');
  }
  requireConsent(farmer, farmerRef);

  const centerId = input.collectionCenterId ?? user.collectionCenterId ?? farmer.collectionCenterId;
  const center = centerId
    ? await prisma.collectionCenter.findFirst({ where: { id: centerId, organizationId: user.organizationId } })
    : null;
  if (!center) {
    throw new HttpException(422, 'Choose a collection center of your cooperative', 'UNKNOWN_COLLECTION_CENTER');
  }

  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0 || input.weightKg > MAX_WEIGHT_KG) {
    throw new HttpException(400, `Weight must be between 0 and ${MAX_WEIGHT_KG} kg`, 'INVALID_WEIGHT');
  }
  // Rounded to what the database keeps, so what the farmer sees is what is stored.
  const weightKg = Math.round(input.weightKg * 100) / 100;
  const deliveredAt = checkDeliveryDate(input.deliveredAt ?? new Date(), 'delivered_at');

  const proposal = await prisma.$transaction(async (tx) => {
    const created = await tx.deliveryProposal.create({
      data: {
        farmerId: farmer.id,
        organizationId: user.organizationId,
        collectionCenterId: center.id,
        weightKg,
        deliveredAt,
        expiresAt: new Date(Date.now() + PROPOSAL_TTL_HOURS * 3600 * 1000),
        createdById: user.id,
      },
      include: proposalInclude,
    });
    await enqueueWebhook(`delivery.proposed:${created.id}`, 'delivery.proposed', proposalData(created), tx);
    return created;
  });

  logger.info({ proposalId: proposal.id, farmerRef, weightKg }, 'Collector recorded a delivery');
  return toDto(proposal);
}

/** The Collector's cooperative's recent deliveries (admins: every cooperative). */
export async function listProposals(viewer: { userId: string; isAdmin: boolean }, status?: DeliveryProposalStatus) {
  const user = await prisma.user.findUnique({ where: { id: viewer.userId } });
  if (!viewer.isAdmin && !(user?.role === StaffRole.COLLECTOR && user.organizationId)) {
    throw new HttpException(403, 'Only Collectors see the deliveries they record', 'UNAUTHORIZED');
  }
  const proposals = await prisma.deliveryProposal.findMany({
    where: {
      ...(!viewer.isAdmin && { organizationId: user!.organizationId! }),
      ...(status && { status }),
    },
    include: proposalInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return proposals.map(toDto);
}

/** The Collector withdraws a delivery that is still waiting, usually to correct it. */
export async function cancel(userId: string, proposalId: string): Promise<DeliveryProposalDto> {
  const user = await collectorOf(userId);
  const proposal = await prisma.deliveryProposal.findUnique({ where: { id: proposalId }, include: proposalInclude });
  if (!proposal || proposal.organizationId !== user.organizationId) {
    throw new HttpException(404, 'Delivery not found', 'PROPOSAL_NOT_FOUND');
  }
  if (!(await close(proposal, DeliveryProposalStatus.CANCELLED))) throw proposalClosed(proposal);
  const updated = await prisma.deliveryProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
  return toDto(updated);
}

/**
 * Closes a proposal that is still waiting (cancelled or expired) and tells
 * VoiceLedger to stop asking, in one transaction. False if it was not waiting.
 */
async function close(proposal: ProposalRow, status: 'CANCELLED' | 'EXPIRED'): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.deliveryProposal.updateMany({
      where: { id: proposal.id, status: DeliveryProposalStatus.PENDING },
      data: { status, closedAt: new Date() },
    });
    if (count !== 1) return false;
    await enqueueWebhook(
      `delivery.proposal_closed:${proposal.id}`,
      'delivery.proposal_closed',
      { proposal_id: proposal.id, farmer_ref: farmerRefOf(proposal), reason: status === 'CANCELLED' ? 'cancelled' : 'expired' },
      tx
    );
    return true;
  });
}

/** Expires the deliveries nobody answered in time and tells VoiceLedger. Run by the worker. */
export async function expireDueProposals(): Promise<number> {
  const due = await prisma.deliveryProposal.findMany({
    where: { status: DeliveryProposalStatus.PENDING, expiresAt: { lt: new Date() } },
    include: proposalInclude,
    take: 50,
  });
  let expired = 0;
  for (const proposal of due) {
    if (await close(proposal, DeliveryProposalStatus.EXPIRED)) expired++;
  }
  if (expired) logger.info({ expired }, 'Expired unanswered deliveries');
  return expired;
}

function proposalClosed(proposal: { status: DeliveryProposalStatus }) {
  return new HttpException(409, `The delivery is ${proposal.status.toLowerCase()}`, 'PROPOSAL_CLOSED', {
    status: proposal.status,
  });
}

export interface ConfirmationResult {
  proposal_id: string;
  accepted: boolean;
  batch_id: string | null;
  farmer_ref: string;
  collection_center: string;
  weight_kg: number;
  delivered_at: string;
  stage: 'DELIVERED' | null;
  data_hash: string | null;
  tx_hash: string | null;
  explorer_url: string | null;
}

/**
 * `delivery.confirmation`: the farmer's answer in the bot. A yes creates the
 * batch on chain; a no closes the proposal. Each proposal is answered once;
 * the same answer again (even with another `event_id`) returns the same
 * result, a different one is `PROPOSAL_CLOSED`.
 */
export async function answer(ctx: IntegrationContext, data: DeliveryConfirmationData): Promise<ConfirmationResult> {
  const farmer = await findRegisteredFarmer(data.farmer_ref);
  let proposal = await prisma.deliveryProposal.findUnique({ where: { id: data.proposal_id }, include: proposalInclude });
  if (!proposal) {
    throw new HttpException(404, `No delivery with proposal_id ${data.proposal_id}`, 'PROPOSAL_NOT_FOUND');
  }
  if (proposal.farmerId !== farmer.id) {
    throw new HttpException(409, 'This delivery belongs to another farmer', 'PROPOSAL_FARMER_MISMATCH');
  }

  if (proposal.status === DeliveryProposalStatus.PENDING) {
    if (proposal.expiresAt < new Date()) {
      await expireDueProposals();
      throw proposalClosed({ status: DeliveryProposalStatus.EXPIRED });
    }
    if (data.accepted) requireConsent(farmer, farmer.farmerRef);

    const { count } = await prisma.deliveryProposal.updateMany({
      where: { id: proposal.id, status: DeliveryProposalStatus.PENDING },
      data: {
        status: data.accepted ? DeliveryProposalStatus.CONFIRMED : DeliveryProposalStatus.REJECTED,
        answerEventId: ctx.integrationEventId,
        answeredAt: new Date(data.answered_at),
        transcript: data.transcript ?? null,
        audioRef: data.audio_ref ?? null,
        closedAt: new Date(),
      },
    });
    proposal = await prisma.deliveryProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
    if (count === 1) {
      logger.info({ proposalId: proposal.id, farmerRef: farmer.farmerRef, accepted: data.accepted }, 'Farmer answered a delivery');
    }
  }

  const expected = data.accepted ? DeliveryProposalStatus.CONFIRMED : DeliveryProposalStatus.REJECTED;
  if (proposal.status !== expected) throw proposalClosed(proposal);

  const base = {
    proposal_id: proposal.id,
    accepted: data.accepted,
    farmer_ref: farmer.farmerRef,
    collection_center: proposal.collectionCenter.name,
    weight_kg: kg(proposal.weightKg),
    delivered_at: proposal.deliveredAt.toISOString(),
  };
  if (!data.accepted) {
    return { ...base, batch_id: null, stage: null, data_hash: null, tx_hash: null, explorer_url: null };
  }

  const { batch, txHash } = await createBatchFromProposal(
    {
      id: proposal.id,
      farmerId: proposal.farmerId,
      organizationId: proposal.organizationId,
      deliveredAt: proposal.deliveredAt,
      weightKg: kg(proposal.weightKg),
      transcript: proposal.transcript,
      audioRef: proposal.audioRef,
      collectionCenter: proposal.collectionCenter,
    },
    farmer.farmerRef,
    proposal.organization.code,
    proposal.answerEventId ?? ctx.integrationEventId
  );
  return {
    ...base,
    batch_id: batch.number,
    stage: 'DELIVERED',
    data_hash: batch.dataHash,
    tx_hash: txHash,
    explorer_url: explorerTxUrl(txHash),
  };
}

/**
 * `GET /api/integrations/voiceledger/farmers/:farmerRef/batches`: the
 * farmer's latest batches and the deliveries waiting for their answer, so the
 * bot can tell them where their coffee is.
 */
export async function farmerBatches(farmerRef: string) {
  const farmer = await findRegisteredFarmer(farmerRef);
  const [batches, pending] = await Promise.all([
    prisma.batch.findMany({
      where: { farmerId: farmer.id, createdOnChainAt: { not: null } },
      include: {
        collectionCenter: { select: { name: true } },
        deliveryProposal: { select: { weightKg: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 1, select: { txHash: true } },
      },
      orderBy: [{ deliveredAt: 'desc' }, { number: 'desc' }],
      take: 20,
    }),
    prisma.deliveryProposal.findMany({
      where: { farmerId: farmer.id, status: DeliveryProposalStatus.PENDING, expiresAt: { gt: new Date() } },
      include: proposalInclude,
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return {
    farmer_ref: farmer.farmerRef,
    batches: batches.map((b) => {
      const tx = b.events[0]?.txHash ?? b.createTx;
      return {
        batch_id: b.number,
        stage: b.stage,
        collection_center: b.collectionCenter.name,
        weight_kg:
          b.weightGrams !== null
            ? Number(b.weightGrams) / 1000
            : b.deliveryProposal
              ? kg(b.deliveryProposal.weightKg)
              : null,
        delivered_at: b.deliveredAt.toISOString(),
        updated_at: b.updatedAt.toISOString(),
        explorer_url: tx ? explorerTxUrl(tx) : null,
      };
    }),
    pending_proposals: pending.map((p) => {
      const { farmer_ref: _ref, ...rest } = proposalData(p);
      return rest;
    }),
  };
}
