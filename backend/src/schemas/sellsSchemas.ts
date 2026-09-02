import { z } from "zod";

export const claimCallbackSchema = z.object({
    body: z.object({
      tx_hash: z
        .string()
        .min(1, 'Transaction hash is required'),
    }),
  });