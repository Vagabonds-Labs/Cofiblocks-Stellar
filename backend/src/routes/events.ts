import { Router, Request, Response } from 'express';

import { authenticate, requireAdmin, validate } from '@/middleware';
import { createEventSchema, updateEventSchema } from '@/schemas/eventSchemas';
import { successResponse } from '@/utils/formatting';
import * as EventsService from '@/services/app/EventsService';
import { logger } from '@/lib/logger';

const router = Router();

/**
 * POST /api/events/create_event
 * Create a new event (Admin only)
 */
router.post(
  '/create_event',
  authenticate,
  requireAdmin,
  validate(createEventSchema),
  async (req: Request, res: Response, next) => {
    const { title, description, location, startDate, endDate, timezone, isAllDay } = req.body;

    const event = await EventsService.createEvent({
      title,
      description,
      location,
      startDate,
      endDate,
      timezone,
      isAllDay,
    });
    logger.info({ eventId: event.id, userId: req.user?.userId }, 'Admin created event');

    successResponse(res, event, 'Event created successfully', 201);
  }
);

/**
 * GET /api/events
 * Get all future events (Unauthenticated)
 */
router.get('/', async (req: Request, res: Response, next) => {
  const events = await EventsService.getFutureEvents();
  successResponse(res, events, 'Events retrieved successfully', 200);
});


router.get('/timezones', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  const timezones = await EventsService.getTimezones();
  successResponse(res, timezones, 'Timezones retrieved successfully', 200);
});

/**
 * GET /api/events/:id
 * Get a single event by ID (Admin only)
 */
router.get('/:id', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  const { id } = req.params;
  const event = await EventsService.getEventById(id);
  successResponse(res, event, 'Event retrieved successfully', 200);
});

/**
 * PATCH /api/events/event
 * Update an existing event (Admin only)
 */
router.patch(
  '/event',
  authenticate,
  requireAdmin,
  validate(updateEventSchema),
  async (req: Request, res: Response, next) => {
    const { id, ...data } = req.body;
    const event = await EventsService.updateEvent(id, data);
    logger.info({ eventId: event.id, userId: req.user?.userId }, 'Admin updated event');
    successResponse(res, event, 'Event updated successfully', 200);
  }
);

/**
 * DELETE /api/events/:id
 * Delete an existing event (Admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  const { id } = req.params;
  await EventsService.deleteEvent(id);
  logger.info({ eventId: id, userId: req.user?.userId }, 'Admin deleted event');
  successResponse(res, null, 'Event deleted successfully', 200);
});

export default router;