import { z } from 'zod';
import { OrderStatus, DeliveryMethod } from '@prisma/client';

export const getOrdersSchema = z.object({
  query: z.object({
    status: z
      .union([
        z.string(),
        z.array(z.string()),
      ])
      .optional()
      .transform((val): OrderStatus[] | undefined => {
        if (!val) return undefined;

        const raw = Array.isArray(val)
          ? val
          : val.split(',').map(s => s.trim());

        return raw.map(s => s as OrderStatus);
      })
      .refine(
        (statuses) =>
          !statuses ||
          statuses.every(s => Object.values(OrderStatus).includes(s)),
        {
          message: `Invalid status value. Must be one of: ${Object.values(OrderStatus).join(', ')}`,
        }
      ),
  }),
});

/**
 * Create order schema
 */
export const createOrderSchema = z.object({
  body: z.object({
    products: z
      .array(
        z.object({
          id: z.string().uuid('Product ID must be a valid UUID'),
          amount: z
            .number()
            .int('Amount must be an integer')
            .positive('Amount must be positive'),
        })
      )
      .min(1, 'Products array cannot be empty'),
  }),
});

/**
 * Get home delivery price schema
 */
export const getHomeDeliveryPriceSchema = z.object({
  body: z.object({
    country: z
      .string()
      .refine((val) => val === 'Costa Rica', {
        message: 'Only Costa Rica is supported for now',
      }),
    state: z
      .string()
      .refine(
        (val) =>
          ['alajuela', 'heredia', 'san jose', 'limon', 'cartago', 'puntarenas', 'guanacaste'].includes(
            val.toLowerCase()
          ),
        {
          message:
            'State must be one of: alajuela, heredia, san jose, limon, cartago, puntarenas, guanacaste',
        }
      ),
    city: z.string().min(1, 'City is required'),
  }),
});

/**
 * Checkout order schema
 */
export const checkoutOrderSchema = z.object({
  body: z.object({
    id: z.string().uuid('Order ID must be a valid UUID'),
    delivery_event_id: z.string().uuid('Delivery event ID must be a valid UUID').optional(),
    delivery_home: z
      .object({
        country: z
          .string()
          .refine((val) => val.toLowerCase() === 'costa rica', {
            message: 'Only Costa Rica is supported for now',
          }),
        state: z
          .string()
          .refine(
            (val) =>
              ['san jose', 'limon', 'guanacaste', 'cartago', 'puntarenas', 'alajuela', 'heredia'].includes(
                val.toLowerCase()
              ),
            {
              message:
                'State must be one of: san jose, limon, guanacaste, cartago, puntarenas, alajuela, heredia',
            }
          ),
        city: z.string().min(3, 'City must be between 3 and 20 characters').max(20, 'City must be between 3 and 20 characters'),
        address1: z.string().min(3, 'Address 1 must be between 3 and 50 characters').max(50, 'Address 1 must be between 3 and 50 characters'),
        address2: z.string().min(3, 'Address 2 must be between 3 and 50 characters').max(50, 'Address 2 must be between 3 and 50 characters').optional(),
        name: z.string().min(3, 'Name must be between 3 and 20 characters').max(20, 'Name must be between 3 and 20 characters'),
        phone: z.string().min(3, 'Phone must be between 3 and 40 characters').max(40, 'Phone must be between 3 and 40 characters').optional(),
      })
      .nullable(),
  })
  .refine(
    (data) => {
      // Either delivery_event_id or delivery_home must be present
      return data.delivery_event_id !== undefined || data.delivery_home !== null;
    },
    {
      message: 'Either delivery_event_id or delivery_home must be provided',
    }
  ),
});

export const checkoutOrderCallbackSchema = z.object({
  body: z.object({
    id: z.string().uuid('Order ID must be a valid UUID'),
    // El frontend devuelve el sobre firmado; el backend lo envía y saca el hash.
    signed_xdr: z.string().min(1, 'Signed transaction XDR is required'),
  }),
});

/**
 * Admin get orders schema
 * Supports filtering by status, buyerId, productId, deliveryMethod, eventId, and date range
 */
export const getAdminOrdersSchema = z.object({
  body: z.object({
    status: z
      .union([
        z.string(),
        z.array(z.string()),
      ])
      .optional()
      .transform((val): OrderStatus[] | undefined => {
        if (!val) return undefined;

        const raw = Array.isArray(val)
          ? val
          : val.split(',').map(s => s.trim());

        return raw.map(s => s as OrderStatus);
      })
      .refine(
        (statuses) =>
          !statuses ||
          statuses.every(s => Object.values(OrderStatus).includes(s)),
        {
          message: `Invalid status value. Must be one of: ${Object.values(OrderStatus).join(', ')}`,
        }
      ),
    buyer_id: z.string().uuid('Buyer ID must be a valid UUID').optional(),
    product_id: z.string().uuid('Product ID must be a valid UUID').optional(),
    delivery_method: z
      .string()
      .optional()
      .transform((val): DeliveryMethod | undefined => {
        if (!val) return undefined;
        return val as DeliveryMethod;
      })
      .refine(
        (method) =>
          !method ||
          Object.values(DeliveryMethod).includes(method),
        {
          message: `Invalid delivery method. Must be one of: ${Object.values(DeliveryMethod).join(', ')}`,
        }
      ),
    event_id: z.string().uuid('Event ID must be a valid UUID').optional(),
    start_date: z
      .string()
      .datetime('Start date must be a valid ISO datetime string')
      .optional()
      .transform((val): Date | undefined => {
        if (!val) return undefined;
        return new Date(val);
      }),
    end_date: z
      .string()
      .datetime('End date must be a valid ISO datetime string')
      .optional()
      .transform((val): Date | undefined => {
        if (!val) return undefined;
        return new Date(val);
      }),
  }),
});

// Type inference from schemas
export type CreateOrderRequest = z.infer<typeof createOrderSchema>['body'];
export type GetHomeDeliveryPriceRequest = z.infer<typeof getHomeDeliveryPriceSchema>['body'];
export type CheckoutOrderRequest = z.infer<typeof checkoutOrderSchema>['body'];

export type GetOrdersQuery = z.infer<typeof getOrdersSchema>['query'];
export type GetAdminOrdersQuery = z.infer<typeof getAdminOrdersSchema>['body'];

