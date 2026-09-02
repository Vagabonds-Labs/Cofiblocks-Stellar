import { z } from 'zod';

/**
 * Create farm schema
 */
export const createFarmSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(200, 'Name must be less than 200 characters')
      .trim(),
    region: z
      .string()
      .min(1, 'Region is required')
      .max(200, 'Region must be less than 200 characters')
      .trim(),
    country: z
      .string()
      .min(1, 'Country is required')
      .max(200, 'Country must be less than 200 characters')
      .trim(),
    altitude: z.preprocess(
        (val) => {
          if (typeof val === 'string' && val.trim() !== '') {
            const parsed = Number(val)
            return Number.isNaN(parsed) ? val : parsed
          }
          return val
        },
        z
          .number()
          .int('Altitude must be an integer')
          .positive('Altitude must be greater than 0')
      ),
    coordinates: z
      .string()
      .min(1, 'Coordinates are required')
      .max(200, 'Coordinates must be less than 200 characters')
      .trim(),
    website: z
      .string()
      .url('Invalid website URL format')
      .optional(),
    logoUrl: z
      .string()
      .url('Invalid logo URL format')
      .optional()
  }),
});

// Type inference from schemas
export type CreateFarmRequest = z.infer<typeof createFarmSchema>['body'];

