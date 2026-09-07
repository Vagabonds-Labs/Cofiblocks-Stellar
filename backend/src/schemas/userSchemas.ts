import { z } from 'zod';

/**
 * Register user schema
 */
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(5, 'Name must be at least 5 characters long')
      .max(25, 'Name must be less than 25 characters')
      .trim(),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password must be less than 128 characters'),
    sellerType: z.enum(['PRODUCER', 'ROASTER']).optional(),
    isAdmin: z.boolean().optional().default(false),
  }),
});

/**
 * Login schema
 */
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    password: z.string().min(1, 'Password is required'),
  }),
});

/**
 * Refresh token schema
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(), // Optional because it can come from cookie
  }),
});

/**
 * Logout schema
 */
export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(), // Optional because it can come from cookie
  }),
});

/**
 * Get sessions schema (query params for pagination, etc.)
 */
export const getSessionsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().min(1).max(100)),
  }),
});

/**
 * Revoke session schema
 */
export const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID format'),
  }),
});

/**
 * Email verification schema
 */
export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
  }),
});

/**
 * Password reset request schema
 */
export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
  }),
});

/**
 * Password reset confirmation schema
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password must be less than 128 characters'),
  }),
});

/**
 * Request verification email resend schema
 */
export const requestVerificationEmailSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
  }),
});

/**
 * Register wallet schema
 */
export const registerWalletSchema = z.object({
  body: z.object({
    // Cuenta clásica de Stellar. Las cuentas contrato (`C…`) no se soportan en v1.
    address: z
      .string()
      .regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address (expected a classic G… account)'),
    // Firma SEP-53 en base64, no el par (r, s) de Starknet.
    signature: z
      .string()
      .min(1, 'Signature is required'),
    // Tiene que venir de POST /api/auth/nonce.
    nonce: z
      .string()
      .min(1, 'Nonce is required'),
  }),
});

export const nonceSchema = z.object({
  body: z.object({
    address: z
      .string()
      .regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address (expected a classic G… account)')
      .optional(),
  }),
});

/**
 * Update user schema
 * At least one field (name or email) must be provided
 */
export const updateUserSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(5, 'Name must be at least 5 characters long')
      .max(25, 'Name must be less than 25 characters')
      .trim()
      .optional(),
      email: z
      .string()
      .email('Invalid email format')
      .toLowerCase()
      .trim()
      .optional(),    
  }).refine(
    (data) => data.name !== undefined || data.email !== undefined,
    { message: 'At least one field (name or email) must be provided' }
  ),
});

/**
 * Get all users schema (for admin)
 * Supports filtering and pagination
 */
export const getAllUsersSchema = z.object({
  query: z.object({
    seller_type: z.enum(['PRODUCER', 'ROASTER']).optional(),
    is_admin: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    email: z.string().optional(),
    name: z.string().optional(),
    wallet_address: z.string().optional(),
    wallet_provider: z.string().optional(),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50))
      .pipe(z.number().int().min(1).max(100)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 0))
      .pipe(z.number().int().min(0)),
  }),
});

// Type inference from schemas
export type RegisterRequest = z.infer<typeof registerSchema>['body'];
export type LoginRequest = z.infer<typeof loginSchema>['body'];
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>['body'];
export type LogoutRequest = z.infer<typeof logoutSchema>['body'];
export type GetSessionsQuery = z.infer<typeof getSessionsSchema>['query'];
export type RevokeSessionParams = z.infer<typeof revokeSessionSchema>['params'];
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>['body'];
export type RequestPasswordResetRequest = z.infer<typeof requestPasswordResetSchema>['body'];
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>['body'];
export type RequestVerificationEmailRequest = z.infer<typeof requestVerificationEmailSchema>['body'];
/**
 * Update seller type schema (admin only)
 */
export const updateSellerTypeSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID format'),
  }),
  body: z.object({
    sellerType: z.enum(['PRODUCER', 'ROASTER']).nullable(),
  }),
});

/**
 * Update admin status schema (admin only)
 */
export const updateAdminStatusSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID format'),
  }),
  body: z.object({
    isAdmin: z.boolean(),
  }),
});

/**
 * Delete user schema (admin only)
 */
export const deleteUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID format'),
  }),
});

export type RegisterWalletRequest = z.infer<typeof registerWalletSchema>['body'];
export type UpdateUserRequest = z.infer<typeof updateUserSchema>['body'];
export type GetAllUsersQuery = z.infer<typeof getAllUsersSchema>['query'];
export type UpdateSellerTypeRequest = z.infer<typeof updateSellerTypeSchema>['body'];
export type UpdateAdminStatusRequest = z.infer<typeof updateAdminStatusSchema>['body'];
export type DeleteUserParams = z.infer<typeof deleteUserSchema>['params'];

