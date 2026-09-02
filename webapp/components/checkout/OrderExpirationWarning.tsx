'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface OrderExpirationWarningProps {
  expiresAt: string | null | undefined
  onExpirationChange?: (isExpired: boolean) => void
}

export function OrderExpirationWarning({ expiresAt, onExpirationChange }: OrderExpirationWarningProps) {
  const t = useTranslations('checkout')
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    if (!expiresAt) return

    const updateCountdown = () => {
      const now = new Date()
      const expiration = new Date(expiresAt)
      const diffMs = expiration.getTime() - now.getTime()
      const diffMinutes = Math.floor(diffMs / (1000 * 60))

      if (diffMinutes <= 0) {
        setIsExpired(true)
        setMinutesRemaining(0)
      } else {
        setIsExpired(false)
        setMinutesRemaining(diffMinutes)
      }
    }

    // Update immediately
    updateCountdown()

    // Update every second
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  // Notify parent when expiration state changes
  useEffect(() => {
    if (onExpirationChange) {
      onExpirationChange(isExpired)
    }
  }, [isExpired, onExpirationChange])

  if (!expiresAt || minutesRemaining === null) {
    return null
  }

  if (isExpired) {
    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
        <p className="text-sm font-medium text-red-800">
          {t('order_expired')}
        </p>
      </div>
    )
  }

  const minuteText = minutesRemaining === 1 
    ? t('expiration_warning_minute_singular', { minutes: minutesRemaining })
    : t('expiration_warning_minute_plural', { minutes: minutesRemaining })

  return (
    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
      <p className="text-sm font-medium text-yellow-800">
        {minuteText}
      </p>
    </div>
  )
}

