import { ROLES } from "@/lib/CofiblocksContracts/types/events";
import { PaymentToken, SwapToken } from "@/lib/CofiblocksContracts/types/transactions";
import { ProductTxType } from "@prisma/client";
import { z } from "zod";

// All valid marketplace event types
const MARKETPLACE_EVENT_TYPES = [
  ...Object.values(ProductTxType),
  'ASSIGN_ROLE',
  'REVOKE_ROLE',
  'CHECKOUT'
] as const;

export const parseEventSchema = z.object({
  body: z.object({
    tx_hash: z.string().min(1, 'Transaction hash is required'),
    tx_type: z.enum(MARKETPLACE_EVENT_TYPES),
  }),
});

export const assignRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(ROLES),
    account: z.string().min(1, 'Account is required'),
  }),
});

export const revokeRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(ROLES),
    account: z.string().min(1, 'Account is required'),
  }),
});

const starknetAddressRegex = /^0x[a-fA-F0-9]{64}$/;

export const withdrawSchema = z.object({
  body: z.object({
    token: z.union([z.nativeEnum(PaymentToken), z.literal('USDC_BRIDGED')]),

    // Receive as string, validate decimal format, then parse
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format')
      .transform((val) => Number(val))
      .refine((val) => val > 0, 'Amount must be greater than 0'),

    withdrawAddress: z
      .string()
      .regex(
        starknetAddressRegex,
        'Invalid Starknet address (expected 0x + 64 hex chars)'
      ),
  }),
});

export const swapSchema = z.object({
  body: z.object({
    token: z.nativeEnum(SwapToken),
    amount: z.number().positive('Amount must be greater than 0')
  }),
});