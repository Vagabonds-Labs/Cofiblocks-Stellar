import { z } from 'zod';

/**
 * Create product schema
 */
export const createProductSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).trim(),
    description: z.string().max(2000).trim().optional(),
    roastLevel: z.string().min(1),
    grindType: z.enum(["WHOLE", "GROUND"]),
    price: z.coerce.number()
      .positive('Price must be positive'),
    currentStock: z.coerce.number()
      .int('Current stock must be an integer')
      .nonnegative('Current stock must be non-negative'),
    imageUrl: z.string().url().optional(),
    farmId: z.string().uuid(),
  })
});


/**
 * Deploy product on chain schema
 */
export const deployProductSchema = z.object({
  body: z.object({
    initialStock: z
      .number()
      .int('Initial stock must be an integer')
      .positive('Initial stock must be positive'),
    price: z
      .number()
      .positive('Price must be positive')
      .finite('Price must be a valid number'),
    product_id: z
      .string()
      .uuid('Product ID must be a valid UUID'),
  }),
});

/**
 * Deploy callback schema
 */
export const deployCallbackSchema = z.object({
  body: z.object({
    product_id: z
      .string()
      .uuid('Product ID must be a valid UUID'),
    // El frontend devuelve el sobre firmado; el backend lo envía y saca el hash.
    signed_xdr: z.string().min(1, 'Signed transaction XDR is required'),
  }),
});


export const productFiltersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    region: z.string().optional(),
    roastLevel: z.string().optional(),
    grindType: z.string().optional(),
    minPrice: z.string().transform(Number).optional().pipe(z.number().nonnegative().optional()),
    maxPrice: z.string().transform(Number).optional().pipe(z.number().nonnegative().optional()),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  }),
});

export const updateProductStockSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    currentStock: z.number().int().positive(),
  }),
});

export const updateProductStockCallbackSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    // El frontend devuelve el sobre firmado; el backend lo envía y saca el hash.
    signed_xdr: z.string().min(1, 'Signed transaction XDR is required'),
  }),
});


// Type inference from schemas
export type CreateProductRequest = z.infer<typeof createProductSchema>['body'];
export type DeployProductRequest = z.infer<typeof deployProductSchema>['body'];
export type DeployCallbackRequest = z.infer<typeof deployCallbackSchema>['body'];

