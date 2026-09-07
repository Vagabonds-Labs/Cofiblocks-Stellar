import { z } from "zod";

export const claimCallbackSchema = z.object({
    body: z.object({
      // El frontend devuelve el sobre firmado; el backend lo envía y saca el hash.
      signed_xdr: z.string().min(1, 'Signed transaction XDR is required'),
    }),
  });