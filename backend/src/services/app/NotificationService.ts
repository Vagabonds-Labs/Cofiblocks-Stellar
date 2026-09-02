import { NotificationLevel } from "@prisma/client";
import { HttpException } from "@/exceptions/HttpException";
import { CreateNotificationEntry, DbNotifications } from "../db/dbNotifications";
import { NotificationListResponse, NotificationResponse } from "./types/Notifications";
import { Locale } from "@/types/locale";
import { isValidLocale, getNotificationMessage } from "@/utils/notifications"

const dbNotifications = new DbNotifications();


export async function createNotification(data: CreateNotificationEntry){
    const notification = await dbNotifications.createNotification(data);
    return notification;
}


export async function getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    lang: Locale = 'en'
  ): Promise<NotificationListResponse> {
    // Validate language
    if (!isValidLocale(lang)) {
      throw new HttpException(400, `Invalid language code: ${lang}`, 'INVALID_LANGUAGE');
    }
    const total = await dbNotifications.countNotificationsByReceiver(userId);
    const unread = await dbNotifications.countUnreadNotificationsByReceiver(userId);

    // Calculate how many unread and read notifications we need
    // Unread notifications always come first, so:
    // - If offset < unread: we need some unread notifications
    // - If offset >= unread: we only need read notifications
    const unreadToFetch = Math.max(0, Math.min(limit, unread - offset));
    const readToFetch = Math.max(0, limit - unreadToFetch);
    const readOffset = Math.max(0, offset - unread);

    // Fetch unread notifications (if needed)
    const unreadNotifications = unreadToFetch > 0
      ? await dbNotifications.findUnreadNotificationsByReceiver(
          userId,
          unreadToFetch,
          Math.max(0, offset)
        )
      : [];

    // Fetch read notifications (if needed)
    const readNotifications = readToFetch > 0
      ? await dbNotifications.findReadNotificationsByReceiver(
          userId,
          readToFetch,
          readOffset
        )
      : [];

    // Combine: unread first, then read
    const notifications = [...unreadNotifications, ...readNotifications];

    const notificationsWithMessages: NotificationResponse[] = notifications.map(
        (notification) => ({
            ...notification,
            message: getNotificationMessage(notification.key, lang, notification.arguments),
        })
    );
    return {
      notifications: notificationsWithMessages,
      unread,
      total,
    };
  }

  /**
   * Mark notifications as read
   * Only updates notifications that don't already have a readAt time
   */
export async function markNotificationsAsRead(notificationIds: string[], userId: string) {
    // First, verify that the user has permission to update all notifications
    const notifications = await dbNotifications.findNotificationsByIds(notificationIds);
    if (notifications.length !== notificationIds.length) {
      throw new HttpException(404, 'One or more notifications not found', 'NOTIFICATIONS_NOT_FOUND');
    }

    // Check permissions: user must be receiver
    const unauthorized = notifications.filter((n) => n.receiverId !== userId);
    if (unauthorized.length > 0) {
      throw new HttpException(
        403,
        'You do not have permission to update these notifications',
        'FORBIDDEN'
      );
    }

    // Filter to only update notifications that don't have readAt set
    const unreadNotificationIds = notifications
      .filter((n) => n.readAt === null)
      .map((n) => n.id);
    if (unreadNotificationIds.length === 0) {
      return await dbNotifications.findNotificationsByIdsFull(notificationIds);
    }

    const now = new Date();
    await dbNotifications.updateNotificationsAsRead(unreadNotificationIds, now);
  }



export async function pushInfoNotification(receiverId: string, key: string, args: string[] = []) {
  await createNotification({
      receiverId,
      senderId: null,
      key,
      arguments: args,
      level: NotificationLevel.INFO,
      logs: '',
  });
}

export async function pushErrorNotification(receiverId: string, key: string, args: string[] = [], logs: string = '') {
  await createNotification({
      receiverId,
      senderId: null,
      key,
      arguments: args,
      level: NotificationLevel.ERROR,
      logs: '',
  });
}