import { Locale } from '@/i18n';
import { Notification } from '@/types/notification';

export interface GetNotificationsOptions {
    limit?: number;
    offset?: number;
    lang?: Locale;
}

export interface NotificationListResponse {
    notifications: Notification[];
    unread: number;
    total: number;
}
