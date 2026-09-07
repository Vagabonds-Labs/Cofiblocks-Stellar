import { ROLES } from "@/lib/StellarContracts/types/contracts";
import { PaymentToken } from "@/lib/StellarContracts/types/transactions";
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

/**
 * Cuenta clásica de Stellar: StrKey `G` + 55 caracteres base32.
 *
 * Las cuentas contrato (`C…`, smart wallets y passkeys) se rechazan a propósito:
 * v1 sólo soporta cuentas clásicas ed25519.
 */
const stellarAddressRegex = /^G[A-Z2-7]{55}$/;

export const withdrawSchema = z.object({
  body: z.object({
    token: z.nativeEnum(PaymentToken),

    // Receive as string, validate decimal format, then parse
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format')
      .transform((val) => Number(val))
      .refine((val) => val > 0, 'Amount must be greater than 0'),

    withdrawAddress: z
      .string()
      .regex(
        stellarAddressRegex,
        'Invalid Stellar address (expected a classic G… account)'
      ),
  }),
});

/** El frontend devuelve el sobre firmado, no un hash. */
export const submitSignedSchema = z.object({
  body: z.object({
    signed_xdr: z.string().min(1, 'Signed transaction XDR is required'),
  }),
});

/**
 * Roles que un usuario puede reclamar por sí mismo. Los institucionales
 * (CAMBIATUS, COFIBLOCKS, COFOUNDER) se cobran fuera de la app.
 */
const selfClaimableRoles = [ROLES.CONSUMER, ROLES.PRODUCER, ROLES.ROASTER] as const;

export const distributionClaimSchema = z.object({
  query: z.object({
    role: z.enum(selfClaimableRoles),
  }),
});

export const distributionClaimCallbackSchema = z.object({
  body: z.object({
    role: z.enum(selfClaimableRoles),
    signed_xdr: z.string().min(1, 'Signed transaction XDR is required'),
  }),
});
