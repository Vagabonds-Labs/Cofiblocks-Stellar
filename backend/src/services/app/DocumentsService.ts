import { createHash } from 'crypto';
import path from 'path';

import { HttpException } from '@/exceptions/HttpException';
import type { PreparedTransaction } from '@/lib/StellarContracts/types/transactions';
import { addressVal, bytes32Val, stringVal } from '@/lib/StellarContracts/utils/scval';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { explorerTxUrl } from '@/services/app/FarmerDataService';
import { worksOnOrganization } from '@/services/app/StagesService';
import * as OnChainTraceabilityService from '@/services/onchain/OnChainTraceabilityService';
import { asStaffSigned, ensureOnChain, transactionPending } from '@/services/onchain/ensureOnChain';
import { DocumentStorage } from '@/services/storage/DocumentStorage';

export const DOCUMENT_KINDS = ['receipt', 'certificate', 'quality', 'sale', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** The contract keeps at most this many document hashes per batch (`MAX_DOCUMENTS`). */
const MAX_DOCUMENTS = 20;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * Any role from the batch's cooperative can attach a document, and so can the
 * Export Manager (the contract checks the same). The signer needs a wallet.
 */
async function loadUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.walletAddress || !user.role) {
    throw new HttpException(403, 'Only staff with a role and a wallet attach documents', 'UNAUTHORIZED');
  }
  return { ...user, walletAddress: user.walletAddress };
}

async function loadBatch(user: Awaited<ReturnType<typeof loadUser>>, batchId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new HttpException(404, 'Batch not found', 'BATCH_NOT_FOUND');
  if (!worksOnOrganization(user, batch.organizationId)) {
    throw new HttpException(403, 'The batch belongs to another cooperative', 'WRONG_ORGANIZATION');
  }
  if (!batch.createdOnChainAt) throw new HttpException(409, 'The batch is not on chain yet', 'BATCH_NOT_ON_CHAIN');
  return batch;
}

export function toDocumentDto(doc: {
  id: string;
  kind: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  txHash: string | null;
  attachedAt: Date | null;
  createdAt: Date;
  uploadedBy?: { name: string | null; role: string | null } | null;
}) {
  return {
    id: doc.id,
    kind: doc.kind,
    fileName: doc.fileName,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    sha256: doc.sha256,
    txHash: doc.attachedAt ? doc.txHash : null,
    attachedAt: doc.attachedAt?.toISOString() ?? null,
    uploadedAt: doc.createdAt.toISOString(),
    uploadedBy: doc.uploadedBy ? { name: doc.uploadedBy.name, role: doc.uploadedBy.role } : null,
  };
}

/**
 * Step 1: stores the file (keyed by its SHA-256) and its row. Uploading the
 * same file again returns the same row, so a failed signature can be retried.
 */
export async function upload(
  userId: string,
  batchId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  kind: DocumentKind
) {
  const user = await loadUser(userId);
  const batch = await loadBatch(user, batchId);
  if (!DOCUMENT_TYPES.includes(file.mimetype)) {
    throw new HttpException(400, 'Upload a PDF, an image, a CSV, an Excel or a Word file', 'INVALID_FILE_TYPE');
  }
  const sha256 = createHash('sha256').update(file.buffer).digest('hex');
  const existing = await prisma.document.findUnique({ where: { batchId_sha256: { batchId, sha256 } } });
  if (existing?.attachedAt) {
    throw new HttpException(409, 'This file is already attached to the batch', 'DOCUMENT_ALREADY_ATTACHED');
  }
  const attached = await prisma.document.count({ where: { batchId, attachedAt: { not: null } } });
  if (attached >= MAX_DOCUMENTS) {
    throw new HttpException(409, `A batch can have at most ${MAX_DOCUMENTS} documents`, 'TOO_MANY_DOCUMENTS');
  }

  const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
  const storagePath = `batches/${batch.id}/${sha256}${ext}`;
  await DocumentStorage.put(storagePath, file.buffer, file.mimetype);
  const fileName = file.originalname.replace(/[\r\n"]/g, '').slice(0, 200) || `document${ext}`;
  const doc = existing
    ? await prisma.document.update({ where: { id: existing.id }, data: { kind, fileName, uploadedById: user.id } })
    : await prisma.document.create({
        data: {
          batchId,
          kind,
          storagePath,
          fileName,
          contentType: file.mimetype,
          sizeBytes: file.size,
          sha256,
          uploadedById: user.id,
        },
      });
  return toDocumentDto(doc);
}

async function loadDocument(userId: string, batchId: string, documentId: string) {
  const user = await loadUser(userId);
  const batch = await loadBatch(user, batchId);
  const doc = await prisma.document.findFirst({ where: { id: documentId, batchId } });
  if (!doc) throw new HttpException(404, 'Document not found', 'DOCUMENT_NOT_FOUND');
  if (doc.uploadedById !== user.id) {
    throw new HttpException(403, 'Whoever uploaded the document signs it', 'UNAUTHORIZED');
  }
  return { user, batch, doc };
}

/** Step 2: the `attach_document` transaction for the uploader's wallet to sign. */
export async function prepareAttach(userId: string, batchId: string, documentId: string): Promise<PreparedTransaction> {
  const { user, batch, doc } = await loadDocument(userId, batchId, documentId);
  if (doc.attachedAt) throw new HttpException(409, 'This file is already attached to the batch', 'DOCUMENT_ALREADY_ATTACHED');
  return OnChainTraceabilityService.prepareAttachDocument(user.walletAddress, batch.number, doc.sha256);
}

/** Step 3: sends the signed transaction (exactly once) and marks the document attached. */
export async function submitAttach(userId: string, batchId: string, documentId: string, signedXdr: string) {
  const { user, batch, doc } = await loadDocument(userId, batchId, documentId);
  const wallet = user.walletAddress;
  OnChainTraceabilityService.assertStaffInvocation(signedXdr, wallet, 'attach_document', [
    addressVal(wallet),
    stringVal(batch.number),
    bytes32Val(doc.sha256),
  ]);
  const txHash = await ensureOnChain({
    label: `attach_document ${batch.number}`,
    state: { tx: doc.txHash, txValidUntil: doc.txValidUntil, confirmedAt: doc.attachedAt },
    send: asStaffSigned(signedXdr),
    claim: async (previous, hash, validUntil) => {
      const { count } = await prisma.document.updateMany({
        where: { id: doc.id, attachedAt: null, txHash: previous },
        data: { txHash: hash, txValidUntil: validUntil },
      });
      return count === 1;
    },
    release: async (hash) => {
      await prisma.document.updateMany({
        where: { id: doc.id, txHash: hash, attachedAt: null },
        data: { txHash: null, txValidUntil: null },
      });
    },
    confirm: async (hash) => {
      await OnChainTraceabilityService.verifyDocumentAttached(hash, batch.number, wallet, doc.sha256);
      await prisma.document.update({
        where: { id: doc.id },
        data: { txHash: hash, txValidUntil: null, attachedAt: new Date() },
      });
    },
    pending: transactionPending,
  });
  logger.info({ batch: batch.number, document: doc.id, txHash }, 'Attached document');
  const saved = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
  return { ...toDocumentDto(saved), explorerUrl: explorerTxUrl(txHash) };
}

/**
 * The file itself, for staff and admins. Its SHA-256 is checked on the way
 * out: what is served is what was hashed on chain.
 */
export async function download(viewer: { userId: string; isAdmin: boolean }, batchId: string, documentId: string) {
  if (!viewer.isAdmin) {
    const user = await prisma.user.findUnique({ where: { id: viewer.userId }, select: { role: true } });
    if (!user?.role) throw new HttpException(403, 'Only staff can open documents', 'UNAUTHORIZED');
  }
  const doc = await prisma.document.findFirst({ where: { id: documentId, batchId } });
  if (!doc) throw new HttpException(404, 'Document not found', 'DOCUMENT_NOT_FOUND');
  const body = await DocumentStorage.get(doc.storagePath);
  if (createHash('sha256').update(body).digest('hex') !== doc.sha256) {
    logger.error({ document: doc.id }, 'Stored file does not match its hash');
    throw new HttpException(409, 'The stored file does not match its hash', 'DOCUMENT_HASH_MISMATCH');
  }
  return { doc, body };
}
