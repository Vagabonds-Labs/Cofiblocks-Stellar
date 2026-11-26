import { Router, Request, Response } from 'express';

import { HttpException } from '@/exceptions/HttpException';
import { authenticate, requireRole } from '@/middleware';
import { uploadDocument } from '@/middleware/upload';
import { validate } from '@/middleware/validation';
import {
  batchIdSchema,
  documentIdSchema,
  exportBatchesSchema,
  listBatchesSchema,
  prepareReceptionSchema,
  prepareStageSchema,
  submitDocumentSchema,
  submitReceptionSchema,
  submitStageSchema,
  uploadDocumentSchema,
} from '@/schemas/batchSchemas';
import * as BatchesService from '@/services/app/BatchesService';
import * as DocumentsService from '@/services/app/DocumentsService';
import * as ReceptionService from '@/services/app/ReceptionService';
import * as StagesService from '@/services/app/StagesService';
import { successResponse } from '@/utils/formatting';

const router = Router();

const viewer = (req: Request): BatchesService.Viewer => ({
  userId: req.user!.userId,
  isAdmin: !!req.user!.is_admin,
});

/**
 * GET /api/batches — every batch (any signed-in user: the data is
 * pseudonymous and already public on Stellar), newest first, with counts per
 * stage. Filters: `stage`, `collection_center_id`, `organization_id`,
 * `search` (batch number or farmer ID).
 */
router.get('/', authenticate, validate(listBatchesSchema), async (req: Request, res: Response) => {
  const q = req.query as unknown as {
    stage?: BatchesService.BatchDto['stage'];
    collection_center_id?: string;
    organization_id?: string;
    search?: string;
    for_me?: 'true' | 'false';
    limit: number;
    offset: number;
  };
  const page = await BatchesService.listBatches(viewer(req), { ...filters(q), limit: q.limit, offset: q.offset });
  successResponse(res, page);
});

function filters(q: {
  stage?: BatchesService.BatchDto['stage'];
  collection_center_id?: string;
  organization_id?: string;
  search?: string;
  for_me?: 'true' | 'false';
}): BatchesService.BatchFilters {
  return {
    stage: q.stage,
    collectionCenterId: q.collection_center_id,
    organizationId: q.organization_id,
    search: q.search || undefined,
    forMe: q.for_me === 'true',
  };
}

/**
 * GET /api/batches/export.csv — the batches (same filters as the list) as
 * CSV, one row per batch with the date and transaction of each step.
 */
router.get('/export.csv', authenticate, validate(exportBatchesSchema), async (req: Request, res: Response) => {
  const csv = await BatchesService.exportBatchesCsv(viewer(req), filters(req.query as Parameters<typeof filters>[0]));
  const day = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cofiblocks-batches-${day}.csv"`);
  // BOM, so Excel opens it as UTF-8.
  res.send(`\uFEFF${csv}`);
});

/**
 * GET /api/batches/summary — the pilot at a glance: farmers, batches per
 * stage, kg received, per cooperative, and the latest on-chain steps.
 */
router.get('/summary', authenticate, async (req: Request, res: Response) => {
  const summary = await BatchesService.getSummary(viewer(req));
  successResponse(res, { summary });
});

/** GET /api/batches/:id — one batch with its history. */
router.get('/:id', authenticate, validate(batchIdSchema), async (req: Request, res: Response) => {
  const batch = await BatchesService.getBatch(viewer(req), req.params.id);
  successResponse(res, { batch });
});

/**
 * POST /api/batches/:id/reception/prepare — Collector, step 1: returns the
 * `record_reception` transaction for their wallet to sign.
 */
router.post(
  '/:id/reception/prepare',
  authenticate,
  requireRole('COLLECTOR'),
  validate(prepareReceptionSchema),
  async (req: Request, res: Response) => {
    const batchNumber = await BatchesService.getBatchNumber(viewer(req), req.params.id);
    const result = await ReceptionService.prepareReception(req.user!.userId, {
      batchNumber,
      weightKg: req.body.weight_kg,
      receiptSha256: req.body.receipt_sha256,
      notes: req.body.notes,
    });
    successResponse(res, result);
  }
);

/**
 * POST /api/batches/:id/reception — Collector, step 2: the signed
 * transaction (with the same weight, receipt and notes). The backend checks
 * it, sends it with fee-bump and the batch moves to RECEIVED.
 */
router.post(
  '/:id/reception',
  authenticate,
  requireRole('COLLECTOR'),
  validate(submitReceptionSchema),
  async (req: Request, res: Response) => {
    const batchNumber = await BatchesService.getBatchNumber(viewer(req), req.params.id);
    const reception = await ReceptionService.submitReception(
      req.user!.userId,
      { batchNumber, weightKg: req.body.weight_kg, receiptSha256: req.body.receipt_sha256, notes: req.body.notes },
      req.body.signed_xdr
    );
    successResponse(res, { reception }, 'Weight and receipt recorded', 200);
  }
);

/** GET /api/batches/:id/verify — compares the stored history and documents with the contract. */
router.get('/:id/verify', authenticate, validate(batchIdSchema), async (req: Request, res: Response) => {
  const verification = await BatchesService.verifyBatch(viewer(req), req.params.id);
  successResponse(res, { verification });
});

const stageInput = (req: Request): StagesService.StageInput => ({
  batchId: req.params.id,
  stage: req.body.stage,
  weightKg: req.body.weight_kg ?? null,
  notes: req.body.notes ?? null,
});

/**
 * POST /api/batches/:id/stage/prepare — Industry Manager, Store Keeper or
 * Export Manager, step 1: the `advance_stage` transaction to sign.
 */
router.post(
  '/:id/stage/prepare',
  authenticate,
  requireRole('INDUSTRY_MANAGER', 'STORE_KEEPER', 'EXPORT_MANAGER'),
  validate(prepareStageSchema),
  async (req: Request, res: Response) => {
    successResponse(res, await StagesService.prepareStage(req.user!.userId, stageInput(req)));
  }
);

/** POST /api/batches/:id/stage — step 2: the signed transaction, with the same stage, weight and notes. */
router.post(
  '/:id/stage',
  authenticate,
  requireRole('INDUSTRY_MANAGER', 'STORE_KEEPER', 'EXPORT_MANAGER'),
  validate(submitStageSchema),
  async (req: Request, res: Response) => {
    const step = await StagesService.submitStage(req.user!.userId, stageInput(req), req.body.signed_xdr);
    successResponse(res, { step }, 'Stage recorded', 200);
  }
);

/**
 * POST /api/batches/:id/documents — any role from the batch's cooperative, or
 * the Export Manager, step 1: uploads the file (multipart, field `file`, and
 * `kind`). It is stored, not attached yet.
 */
router.post(
  '/:id/documents',
  authenticate,
  uploadDocument,
  validate(uploadDocumentSchema),
  async (req: Request, res: Response) => {
    if (!req.file) throw new HttpException(400, 'Send the file in the field "file"', 'FILE_REQUIRED');
    const document = await DocumentsService.upload(req.user!.userId, req.params.id, req.file, req.body.kind);
    successResponse(res, { document }, 'Document uploaded', 201);
  }
);

/** POST /api/batches/:id/documents/:documentId/prepare — step 2: the `attach_document` transaction to sign. */
router.post(
  '/:id/documents/:documentId/prepare',
  authenticate,
  validate(documentIdSchema),
  async (req: Request, res: Response) => {
    const prepared = await DocumentsService.prepareAttach(req.user!.userId, req.params.id, req.params.documentId);
    successResponse(res, { prepared });
  }
);

/** POST /api/batches/:id/documents/:documentId/attach — step 3: the signed transaction. */
router.post(
  '/:id/documents/:documentId/attach',
  authenticate,
  validate(submitDocumentSchema),
  async (req: Request, res: Response) => {
    const document = await DocumentsService.submitAttach(
      req.user!.userId,
      req.params.id,
      req.params.documentId,
      req.body.signed_xdr
    );
    successResponse(res, { document }, 'Document attached', 200);
  }
);

/** GET /api/batches/:id/documents/:documentId/file — the file (staff and admins). */
router.get(
  '/:id/documents/:documentId/file',
  authenticate,
  validate(documentIdSchema),
  async (req: Request, res: Response) => {
    const { doc, body } = await DocumentsService.download(viewer(req), req.params.id, req.params.documentId);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader('X-Content-SHA256', doc.sha256);
    res.send(body);
  }
);

export default router;
