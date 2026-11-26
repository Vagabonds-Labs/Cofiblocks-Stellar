import { BatchStage } from '@prisma/client';
import { z } from 'zod';

export const listBatchesSchema = z.object({
  query: z.object({
    stage: z.enum(BatchStage).optional(),
    collection_center_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    search: z.string().trim().max(64).optional(),
    /** Only the batches the viewer's role can move forward now. */
    for_me: z.enum(['true', 'false']).optional(),
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

export const exportBatchesSchema = z.object({
  query: z.object({
    stage: z.enum(BatchStage).optional(),
    collection_center_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    search: z.string().trim().max(64).optional(),
    for_me: z.enum(['true', 'false']).optional(),
  }),
});

const stageBody = {
  stage: z.enum(BatchStage),
  /** Weight after this stage, in kg (optional). */
  weight_kg: z.number().positive().max(5000).nullish(),
  notes: z.string().trim().max(500).nullish(),
};

export const prepareStageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object(stageBody),
});

export const submitStageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ ...stageBody, signed_xdr: z.string().min(1).max(20_000) }),
});

export const uploadDocumentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ kind: z.enum(['receipt', 'certificate', 'quality', 'sale', 'other']).default('other') }),
});

export const documentIdSchema = z.object({
  params: z.object({ id: z.string().uuid(), documentId: z.string().uuid() }),
});

export const submitDocumentSchema = z.object({
  params: z.object({ id: z.string().uuid(), documentId: z.string().uuid() }),
  body: z.object({ signed_xdr: z.string().min(1).max(20_000) }),
});
