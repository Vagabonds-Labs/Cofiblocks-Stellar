import { Router, Request, Response } from 'express';

import { verifyVoiceLedgerSignature } from '@/middleware/voiceLedgerSignature';
import { HttpException } from '@/exceptions/HttpException';
import * as DeliveryProposalsService from '@/services/app/DeliveryProposalsService';
import * as IntegrationService from '@/services/app/IntegrationService';

const router = Router();

/**
 * POST /api/integrations/voiceledger/events
 *
 * One signed event from VoiceLedger's farmer bot. The contract with
 * VoiceLedger is documented in `docs/voiceledger-integration.md`.
 */
router.post('/voiceledger/events', verifyVoiceLedgerSignature, async (req: Request, res: Response) => {
  const { status, body } = await IntegrationService.receiveVoiceLedgerEvent(req.body);
  res.status(status).json(body);
});

/** GET /api/integrations/voiceledger/events/:eventId — status of an event. */
router.get('/voiceledger/events/:eventId', verifyVoiceLedgerSignature, async (req: Request, res: Response) => {
  const { status, body } = await IntegrationService.getVoiceLedgerEvent(req.params.eventId);
  res.status(status).json(body);
});

/**
 * GET /api/integrations/voiceledger/farmers/:farmerRef/batches — the farmer's
 * latest batches and the deliveries waiting for their answer ("where is my
 * coffee?"). Errors use the same `error` object as the events.
 */
router.get('/voiceledger/farmers/:farmerRef/batches', verifyVoiceLedgerSignature, async (req: Request, res: Response) => {
  try {
    res.json(await DeliveryProposalsService.farmerBatches(req.params.farmerRef.trim().toUpperCase()));
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    res.status(error.statusCode).json({ status: 'failed', error: { code: error.code, message: error.message } });
  }
});

export default router;
