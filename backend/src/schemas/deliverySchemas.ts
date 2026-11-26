import { DeliveryProposalStatus } from '@prisma/client';
import { z } from 'zod';

import { MAX_WEIGHT_KG } from '@/config/pilot';

export const listDeliveryFarmersSchema = z.object({
  query: z.object({ search: z.string().trim().max(64).optional() }),
});

export const listDeliveriesSchema = z.object({
  query: z.object({ status: z.enum(DeliveryProposalStatus).optional() }),
});

export const proposeDeliverySchema = z.object({
  body: z.object({
    farmer_id: z.uuid(),
    /** Defaults to the Collector's own center. */
    collection_center_id: z.uuid().optional(),
    /** Weight on the scale, in kg (kept to 2 decimals). */
    weight_kg: z.number().positive().max(MAX_WEIGHT_KG),
    /** Defaults to now. */
    delivered_at: z.iso.datetime({ offset: true }).optional(),
  }),
});

export const deliveryIdSchema = z.object({
  params: z.object({ id: z.uuid() }),
});
