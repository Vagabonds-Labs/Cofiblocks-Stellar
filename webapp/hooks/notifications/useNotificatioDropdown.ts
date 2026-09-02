'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { Locale } from '@/i18n'

import { useNotificationStore } from '@/lib/stores/notificationStore'

interface Params {
  isLoggedIn: boolean
  selectedLanguage: Locale
}

export function useNotificationDropdown({
  isLoggedIn,
  selectedLanguage,
}: Params) {
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchUnread,
    fetchNotifications,
    markAsRead,
  } = useNotificationStore()

  const [showDropdown, setShowDropdown] = useState(false)
  const [viewedSet, setViewedSet] = useState<Set<string>>(new Set())

  const dropdownRef = useRef<HTMLDivElement>(null)
  const prevOpenState = useRef(false)

  // --- Fetch unread on login ---
  useEffect(() => {
    if (!isLoggedIn) return
    fetchUnread(selectedLanguage)
  }, [isLoggedIn, selectedLanguage, fetchUnread])

  // --- Fetch notifications when opening ---
  useEffect(() => {
    if (showDropdown && isLoggedIn) {
      fetchNotifications(selectedLanguage)
    }
  }, [showDropdown, isLoggedIn, selectedLanguage, fetchNotifications])

  // --- Track viewed notifications ---
  useEffect(() => {
    if (!showDropdown) return

    const unreadIds = notifications
      .filter(n => !n.readAt)
      .map(n => n.id)

    setViewedSet(new Set(unreadIds))
  }, [notifications, showDropdown])

  // --- Mark as read on close ---
  useEffect(() => {
    const wasOpen = prevOpenState.current
    prevOpenState.current = showDropdown

    if (wasOpen && !showDropdown && viewedSet.size > 0) {
      markAsRead([...viewedSet]).then(() => {
        fetchUnread(selectedLanguage)
      })
      setViewedSet(new Set())
    }
  }, [showDropdown, viewedSet, markAsRead, fetchUnread, selectedLanguage])

  // --- Click outside ---
  useEffect(() => {
    if (!showDropdown) return

    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  // --- Polling ---
  useEffect(() => {
    if (!isLoggedIn) return

    fetchUnread(selectedLanguage)

    const interval = setInterval(() => {
      fetchUnread(selectedLanguage)
      if (showDropdown) {
        fetchNotifications(selectedLanguage)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [isLoggedIn, selectedLanguage, showDropdown, fetchUnread, fetchNotifications])

  // --- Sorted notifications ---
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      if (!a.readAt && b.readAt) return -1
      if (a.readAt && !b.readAt) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [notifications])

  return {
    dropdownRef,
    showDropdown,
    setShowDropdown,
    unreadCount,
    sortedNotifications,
    isLoading,
    isLoggedIn,
  }
}
