import { BatchStage } from '@prisma/client';
import { z } from 'zod';

export const listBatchesSchema = z.object({
  query: z.object({
    stage: z.enum(BatchStage).optional(),
    collection_center_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    search: z.string().trim().max(64).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

export const batchIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const receptionBody = {
  /** Weight on the scale, in kg (up to grams). */
  weight_kg: z.number().positive().max(5000),
  /** SHA-256 (hex) of the receipt photo, computed in the browser. */
  receipt_sha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
  notes: z.string().trim().max(500).nullish(),
};

export const prepareReceptionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object(receptionBody),
});

export const submitReceptionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ ...receptionBody, signed_xdr: z.string().min(1).max(20_000) }),
});
