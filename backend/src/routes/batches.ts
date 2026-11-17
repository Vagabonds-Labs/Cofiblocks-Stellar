import { Router, Request, Response } from 'express';

import { authenticate, requireRole } from '@/middleware';
import { validate } from '@/middleware/validation';
import {
  batchIdSchema,
  listBatchesSchema,
  prepareReceptionSchema,
  submitReceptionSchema,
} from '@/schemas/batchSchemas';
import * as BatchesService from '@/services/app/BatchesService';
import * as ReceptionService from '@/services/app/ReceptionService';
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
    limit: number;
    offset: number;
  };
  const page = await BatchesService.listBatches(viewer(req), {
    stage: q.stage,
    collectionCenterId: q.collection_center_id,
    organizationId: q.organization_id,
    search: q.search || undefined,
    limit: q.limit,
    offset: q.offset,
  });
  successResponse(res, page);
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

export default router;
