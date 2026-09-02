import { prisma } from '@/lib/prisma';
import { NotificationLevel } from '@prisma/client';

export interface CreateNotificationEntry {
  receiverId: string;
  senderId: string | null;
  key: string;
  arguments: string[];
  level: NotificationLevel;
  logs: string | null;
}

export interface NotificationEntry {
  id: string;
  receiverId: string;
  senderId: string | null;
  key: string;
  arguments: string[];
  level: NotificationLevel;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationForUpdateEntry {
  id: string;
  receiverId: string;
  readAt: Date | null;
}

export class DbNotifications {
  async createNotification(data: CreateNotificationEntry): Promise<NotificationEntry> {
    const notification = await prisma.notification.create({
      data: {
        receiverId: data.receiverId,
        senderId: data.senderId,
        key: data.key,
        arguments: data.arguments,
        level: data.level,
        logs: data.logs,
      },
      select: {
        id: true,
        receiverId: true,
        senderId: true,
        key: true,
        arguments: true,
        level: true,
        readAt: true,
        createdAt: true,
      },
    });

    return notification;
  }

  async countNotificationsByReceiver(receiverId: string): Promise<number> {
    return await prisma.notification.count({
      where: { receiverId },
    });
  }

  async countUnreadNotificationsByReceiver(receiverId: string): Promise<number> {
    return await prisma.notification.count({
      where: {
        receiverId,
        readAt: null,
      },
    });
  }

  async findUnreadNotificationsByReceiver(
    receiverId: string,
    take: number,
    skip: number
  ): Promise<NotificationEntry[]> {
    const notifications = await prisma.notification.findMany({
      where: {
        receiverId,
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        receiverId: true,
        senderId: true,
        key: true,
        arguments: true,
        level: true,
        readAt: true,
        createdAt: true,
      },
    });

    return notifications;
  }

  async findReadNotificationsByReceiver(
    receiverId: string,
    take: number,
    skip: number
  ): Promise<NotificationEntry[]> {
    const notifications = await prisma.notification.findMany({
      where: {
        receiverId,
        readAt: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        receiverId: true,
        senderId: true,
        key: true,
        arguments: true,
        level: true,
        readAt: true,
        createdAt: true,
      },
    });

    return notifications;
  }

  async findNotificationsByIds(notificationIds: string[]): Promise<NotificationForUpdateEntry[]> {
    const notifications = await prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
      },
      select: {
        id: true,
        receiverId: true,
        readAt: true,
      },
    });

    return notifications;
  }

  async findNotificationsByIdsFull(notificationIds: string[]): Promise<NotificationEntry[]> {
    const notifications = await prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
      },
      select: {
        id: true,
        receiverId: true,
        senderId: true,
        key: true,
        arguments: true,
        level: true,
        readAt: true,
        createdAt: true,
      },
    });

    return notifications;
  }

  async updateNotificationsAsRead(notificationIds: string[], readAt: Date): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
      },
      data: {
        readAt,
      },
    });
  }
}

