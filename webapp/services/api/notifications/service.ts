/**
 * Notification Service
 * Handles notification-related API calls
 */

import { api } from '@/lib/api';
import { Locale } from '@/i18n';
import { GetNotificationsOptions, NotificationListResponse } from './types';


export class NotificationService {
  /**
   * Get all notifications for the current user
   * @param options - Query options (limit, offset, lang)
   * @returns Notification list with unread count
   */
  async getNotifications(options: GetNotificationsOptions = {}): Promise<NotificationListResponse> {
    const { limit = 20, offset = 0, lang = 'en' } = options;
    const response = await api.get<{ data: NotificationListResponse }>(
      `/notifications?lang=${lang}&limit=${limit}&offset=${offset}`
    );
    return response.data;
  }

  /**
   * Get unread notification count
   * @param lang - Language code for message formatting
   * @returns Number of unread notifications
   */
  async getUnreadCount(lang: Locale = 'en'): Promise<number> {
    const response = await this.getNotifications({ limit: 1, offset: 0, lang });
    return response.unread;
  }

  /**
   * Mark one or more notifications as read
   * @param notificationIds - Array of notification IDs to mark as read
   * @returns Updated notifications
   */
  async markAsRead(notificationIds: string[]): Promise<void> {
    await api.patch<{ }>(
      '/notifications',
      { notificationIds }
    );
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
