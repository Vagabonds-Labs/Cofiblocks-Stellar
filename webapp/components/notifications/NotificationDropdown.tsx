'use client'

import {
  InboxIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { NotificationDropdownProps } from './types'
import { useNotificationDropdown } from '../../hooks/notifications/useNotificatioDropdown'
import { Locale } from '@/i18n'

export function NotificationDropdown({
  isLoggedIn,
  selectedLanguage,
  textColor,
  progress,
  bottom,
}: NotificationDropdownProps) {
  const t = useTranslations()

  const {
    dropdownRef,
    showDropdown,
    setShowDropdown,
    unreadCount,
    sortedNotifications,
    isLoading,
  } = useNotificationDropdown({
    isLoggedIn,
    selectedLanguage: selectedLanguage as Locale,
  })

  const getIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />
      default:
        return <CheckCircleIcon className="w-5 h-5 text-blue-500" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl hover:bg-[rgba(40,107,86,0.12)] transition-colors"
        style={{ color: textColor }}
      >
        <InboxIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && isLoggedIn && (
        <div
          className="absolute right-0 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0 mt-2 w-[calc(100vw-2rem)] md:w-96 max-h-[500px] rounded-2xl shadow-[0_18px_42px_rgba(12,35,26,0.18)] border border-white/60 overflow-y-auto z-50"
          style={{
            background: `rgba(${bottom}, ${bottom}, ${bottom}, 0.96)`,
            borderColor: `rgba(211,220,214,0.9)`,
          }}
        >
          <div className="p-4 border-b border-[rgba(211,220,214,0.9)]">
            <h3 className="font-semibold" style={{ color: textColor }}>
              {t('notifications.title')}
            </h3>
          </div>

          {isLoading && sortedNotifications.length === 0 ? (
            <div className="p-8 text-center" style={{ color: textColor }}>
              {t('notifications.loading')}
            </div>
          ) : sortedNotifications.length === 0 ? (
            <div className="p-8 text-center" style={{ color: textColor }}>
              {t('notifications.empty')}
            </div>
          ) : (
            sortedNotifications.map(n => {
              const isUnread = !n.readAt
              return (
                <div
                  key={n.id}
                  className="p-4 flex gap-3 border-b border-[rgba(211,220,214,0.8)]"
                  style={{
                    backgroundColor: isUnread
                      ? `rgba(233, 241, 236, 0.55)`
                      : `rgba(${bottom}, ${bottom}, ${bottom}, 0.5)`,
                  }}
                >
                  {getIcon(n.level)}
                  <div className="flex-1">
                    <p
                      className={`text-sm ${isUnread ? 'font-bold' : ''}`}
                      style={{ color: textColor }}
                    >
                      {n.message || n.key}
                    </p>
                    <p
                      className="text-xs opacity-70"
                      style={{ color: textColor }}
                    >
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
