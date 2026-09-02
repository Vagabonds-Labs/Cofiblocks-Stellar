import { NotificationLevel } from "@prisma/client";

export interface NotificationResponse {
    id: string;
    receiverId: string;
    senderId: string | null;
    key: string;
    arguments: string[];
    level: NotificationLevel;
    readAt: Date | null;
    createdAt: Date;
    message?: string; // Formatted message based on locale
  }
  
  export interface NotificationListResponse {
    notifications: NotificationResponse[];
    unread: number;
    total: number;
  }