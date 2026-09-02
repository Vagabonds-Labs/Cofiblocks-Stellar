import { z } from 'zod';

/**
 * Create event schema
 */
export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    location: z.string().min(1, 'Location is required'),
    startDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/,
        "Invalid local datetime (expected YYYY-MM-DDTHH:mm)"
      ),
    endDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/,
        "Invalid local datetime (expected YYYY-MM-DDTHH:mm)"
      ).optional(),
    timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$/, "Invalid IANA timezone"),
    isAllDay: z.boolean().optional().default(false),
  }),
});

/**
 * Update event schema
 */
export const updateEventSchema = z.object({
  body: z.object({
    id: z.string().uuid('Event ID is required'),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    location: z.string().min(1).optional(),
    startAt: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/,
        "Invalid local datetime (expected YYYY-MM-DDTHH:mm)"
      ),
    endAt: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/,
        "Invalid local datetime (expected YYYY-MM-DDTHH:mm)"
      ).optional(),
    timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$/, "Invalid IANA timezone").optional(),
    isAllDay: z.boolean().optional(),
  }),
});

// Type inference from schemas
export type CreateEventRequest = z.infer<typeof createEventSchema>['body'];
export type UpdateEventRequest = z.infer<typeof updateEventSchema>['body'];

