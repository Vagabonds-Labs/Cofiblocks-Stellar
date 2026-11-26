import { Router, Request, Response } from 'express';

import { authenticate, requireRole } from '@/middleware';
import { validate } from '@/middleware/validation';
import {
  deliveryIdSchema,
  listDeliveriesSchema,
  listDeliveryFarmersSchema,
  proposeDeliverySchema,
} from '@/schemas/deliverySchemas';
import * as DeliveryProposalsService from '@/services/app/DeliveryProposalsService';
import { successResponse } from '@/utils/formatting';

/**
 * Deliveries the Collector records at the collection center. Each waits for
 * the farmer to confirm it in the VoiceLedger bot; only then is the batch
 * created on chain (see `DeliveryProposalsService`).
 */
const router = Router();

/** GET /api/deliveries/farmers — farmers of the Collector's cooperative, for the form. */
router.get(
  '/farmers',
  authenticate,
  requireRole('COLLECTOR'),
  validate(listDeliveryFarmersSchema),
  async (req: Request, res: Response) => {
    const search = (req.query.search as string | undefined) || undefined;
    const farmers = await DeliveryProposalsService.listFarmersForDelivery(req.user!.userId, search);
    successResponse(res, { farmers });
  }
);

/** GET /api/deliveries — the cooperative's latest recorded deliveries and their answer. */
router.get('/', authenticate, validate(listDeliveriesSchema), async (req: Request, res: Response) => {
  const deliveries = await DeliveryProposalsService.listProposals(
    { userId: req.user!.userId, isAdmin: !!req.user!.is_admin },
    req.query.status as Parameters<typeof DeliveryProposalsService.listProposals>[1]
  );
  successResponse(res, { deliveries });
});

/** POST /api/deliveries — the Collector records a delivery; the farmer is asked to confirm it. */
router.post(
  '/',
  authenticate,
  requireRole('COLLECTOR'),
  validate(proposeDeliverySchema),
  async (req: Request, res: Response) => {
    const delivery = await DeliveryProposalsService.propose(req.user!.userId, {
      farmerId: req.body.farmer_id,
      collectionCenterId: req.body.collection_center_id,
      weightKg: req.body.weight_kg,
      deliveredAt: req.body.delivered_at ? new Date(req.body.delivered_at) : undefined,
    });
    successResponse(res, { delivery }, 'Delivery recorded: waiting for the farmer to confirm it', 201);
  }
);

/** POST /api/deliveries/:id/cancel — withdraw a delivery still waiting for the farmer. */
router.post(
  '/:id/cancel',
  authenticate,
  requireRole('COLLECTOR'),
  validate(deliveryIdSchema),
  async (req: Request, res: Response) => {
    const delivery = await DeliveryProposalsService.cancel(req.user!.userId, req.params.id);
    successResponse(res, { delivery });
  }
);

export default router;
