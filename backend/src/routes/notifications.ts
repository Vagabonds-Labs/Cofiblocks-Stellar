import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin, validate } from '@/middleware';
import {
  createNotificationSchema,
  GetNotificationsQuery,
  getNotificationsSchema,
  updateNotificationsSchema,
  type CreateNotificationRequest,
  type UpdateNotificationsRequest,
} from '@/schemas/notificationSchemas';
import { successResponse } from '@/utils/formatting';
import * as NotificationService from '@/services/app/NotificationService';
import { Locale } from '@/types/locale';

const router = Router();


/**
 * POST /api/notifications
 * Create a new notification
 * Requires: caller must be the receiver_id OR have is_admin = true
 */
router.post('/', authenticate, requireAdmin, validate(createNotificationSchema), async (req: Request, res: Response) => {
    const { receiverId, key, arguments: args, level }: CreateNotificationRequest = req.body;

    // Create the notification
    const notification = await NotificationService.createNotification({
      receiverId,
      senderId: null,
      key,
      arguments: args,
      level,
      logs: '',
    });

    successResponse(res, notification, 'Notification created successfully');
  }
);

/**
 * GET /api/notifications
 * Get all notifications for the current user
 * Includes unread count and pagination
 */
router.get('/', authenticate, validate(getNotificationsSchema), async (req, res) => {
    const userId = req.user!.userId;
    const { limit, offset, lang } = req.query;
    const limitNumber = limit ? Number(limit) : 20;
    const offsetNumber = offset ? Number(offset) : 0;
    const langString = lang ? String(lang) : 'en';

    const result = await NotificationService.getUserNotifications(
      userId,
      limitNumber,
      offsetNumber,
      langString as Locale
    );

    successResponse(res, result);
  }
);


/**
 * PATCH /api/notifications
 * Mark one or more notifications as read
 * Only marks notifications that don't already have a readAt time
 * Requires: caller must be the receiver_id of the notification OR have is_admin = true
 */
router.patch(
  '/',
  authenticate,
  validate(updateNotificationsSchema),
  async (req: Request, res: Response) => {
    const { notificationIds }: UpdateNotificationsRequest = req.body;
    const userId = req.user!.userId;

    // Mark notifications as read
    await NotificationService.markNotificationsAsRead(
      notificationIds,
      userId
    );
    successResponse(res, null, 'Notifications marked as read successfully');
  }
);

export default router;

