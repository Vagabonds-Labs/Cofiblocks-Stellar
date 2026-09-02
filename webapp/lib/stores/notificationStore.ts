// lib/stores/notificationStore.ts
import { create } from 'zustand'
import { Locale } from '@/i18n'
import { notificationService } from '@/services/api/notifications'
import type { Notification } from '@/types/notification'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean

  fetchUnread: (lang: Locale) => Promise<void>
  fetchNotifications: (lang: Locale) => Promise<void>
  markAsRead: (ids: string[]) => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchUnread: async (lang: Locale) => {
    const unread = await notificationService.getUnreadCount(lang)
    set({ unreadCount: unread })
  },

  fetchNotifications: async (lang: Locale) => {
    set({ isLoading: true })
    try {
      const res = await notificationService.getNotifications({ limit: 7, offset: 0, lang })
      set({
        notifications: res.notifications,
        unreadCount: res.unread,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  markAsRead: async (ids) => {
    if (ids.length === 0) return

    await notificationService.markAsRead(ids)

    const updated = get().notifications.map((n) =>
      ids.includes(n.id) ? { ...n, readAt: new Date() } : n
    )

    set({
      notifications: updated,
      unreadCount: Math.max(0, get().unreadCount - ids.length),
    })
  },
}))
