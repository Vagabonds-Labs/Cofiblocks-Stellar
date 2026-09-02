'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useRef } from 'react'
import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { OrderSuccess } from '@/components/checkout'
import { orderService } from '@/services/api/orders/service'
import { Order } from '@/services/api/orders/types'

export default function StripeCallbackPage() {
  const { orderId } = useParams()
  const router = useRouter()
  const t = useTranslations()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasRetriedRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isValidStatus = (status: string): boolean => {
    return status === 'PAID' || status === 'PENDING_DELIVERY' || status === 'IN_DELIVERY'
  }

  const fetchOrder = async (isRetry: boolean = false) => {
    try {
      if (!isRetry) {
        setLoading(true)
        setError(null)
      }
      const fetchedOrder = await orderService.getOrderById(orderId as string)
      setOrder(fetchedOrder)

      if (isValidStatus(fetchedOrder.status)) {
        // Success - order is in valid state
        setLoading(false)
        return
      }

      // Order is not in valid state
      if (!isRetry && !hasRetriedRef.current) {
        // First attempt failed, wait 8 seconds and retry
        hasRetriedRef.current = true
        timeoutRef.current = setTimeout(() => {
          fetchOrder(true)
        }, 8000)
      } else {
        // Already retried or this is the retry attempt that failed - show error
        setError(
          t('checkout.order_status_error', { status: fetchedOrder.status })
        )
        setLoading(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : t('checkout.fetch_order_status_error')
      setError(t('checkout.error_contact_support', { error: errorMessage }))
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [orderId])

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">{t('checkout.loading')}</p>
          {hasRetriedRef.current && (
            <p className="text-sm text-gray-500 mt-2">{t('checkout.verifying_payment_status')}</p>
          )}
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-2xl w-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h1 className="text-xl font-bold text-red-900 mb-2">
                  {t('checkout.payment_verification_failed')}
                </h1>
                <p className="text-red-800 mb-4">{error}</p>
                <button
                  onClick={() => router.push('/')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  {t('checkout.return_to_home')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show success if order is in valid state
  if (order && isValidStatus(order.status)) {
    return (
      <OrderSuccess
        order={order}
        t={t}
        onOk={() => router.push('/')}
      />
    )
  }

  // Fallback (shouldn't reach here, but just in case)
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-lg text-gray-600">{t('checkout.processing')}</p>
    </div>
  )
}
