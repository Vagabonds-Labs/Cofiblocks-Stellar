'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'

import { orderService, Order, OrderStatus } from '@/services/api/orders'
import { formatCurrency, formatDate, formatEventDateTime } from '@/utils/formatting'

type StatusConfig = {
  label: string
  color: string
  icon: any
  description: string
}

const getStatusBadgeClass = (color: string) => {
  const colorMap: Record<string, string> = {
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  }
  return colorMap[color] || 'bg-gray-100 text-gray-800 border-gray-300'
}

const getStatusIconClass = (color: string) => {
  const colorMap: Record<string, string> = {
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
    red: 'text-red-600',
  }
  return colorMap[color] || 'text-gray-600'
}

export default function OrderDetailPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const statusConfig: Record<OrderStatus, StatusConfig> = {
    PENDING_PAYMENT: {
      label: t('my_orders.status.pending_payment'),
      color: 'yellow',
      icon: ClockIcon,
      description: t('my_orders.status_description.pending_payment'),
    },
    PAID: {
      label: t('my_orders.status.paid'),
      color: 'blue',
      icon: CheckCircleIcon,
      description: t('my_orders.status_description.paid'),
    },
    PENDING_DELIVERY_PAYMENT: {
      label: t('my_orders.status.pending_delivery_payment'),
      color: 'orange',
      icon: ClockIcon,
      description: t('my_orders.status_description.pending_delivery_payment'),
    },
    IN_DELIVERY: {
      label: t('my_orders.status.in_delivery'),
      color: 'purple',
      icon: TruckIcon,
      description: t('my_orders.status_description.in_delivery'),
    },
    DELIVERED: {
      label: t('my_orders.status.delivered'),
      color: 'green',
      icon: CheckCircleIcon,
      description: t('my_orders.status_description.delivered'),
    },
    CANCELLED: {
      label: t('my_orders.status.cancelled'),
      color: 'red',
      icon: XCircleIcon,
      description: t('my_orders.status_description.cancelled'),
    },
  }

  useEffect(() => {
    if (!orderId) return

    let cancelled = false

    const loadOrder = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await orderService.getOrderById(orderId)
        if (!cancelled) {
          setOrder(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t('my_orders.no_orders_general')
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadOrder()

    return () => {
      cancelled = true
    }
  }, [orderId, t])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
              <p className="mt-4 text-gray-600">{t('my_orders.loading')}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => router.push(`/${locale}/my-orders`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>{t('my_orders.title')}</span>
          </button>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || t('my_orders.no_orders_general')}
          </div>
        </main>
      </div>
    )
  }

  const config = statusConfig[order.status]
  const Icon = config.icon

  const itemsTotal = order.orderItems.reduce(
    (sum, item) => sum + item.product.price * item.items,
    0
  )
  const deliveryPrice = order.delivery?.price || 0
  const grandTotal = itemsTotal + deliveryPrice

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/${locale}/my-orders`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>{t('my_orders.title')}</span>
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {/* Header */}
          <div className="mb-6 space-y-4">
            {/* Order Number - Full width on mobile */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${getStatusIconClass(config.color)}`} />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {t('my_orders.order_prefix')}
                {order.id.slice(0, 8)}
              </h1>
            </div>
            
            {/* Status and Date - Stack on mobile, side by side on larger screens */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium border ${getStatusBadgeClass(
                    config.color
                  )}`}
                >
                  {config.label}
                </span>
                <p className="text-xs sm:text-sm text-gray-500 sm:hidden">{config.description}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500">
                  {t('my_orders.order_date')}
                </p>
                <p className="text-xs sm:text-sm font-medium text-gray-900">
                  {formatDate(order.createdAt)}
                </p>
              </div>
            </div>
            
            {/* Description - Hidden on mobile, shown on larger screens */}
            <p className="hidden sm:block text-sm text-gray-500">{config.description}</p>
          </div>

          {/* Items */}
          <section className="mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
              {t('my_orders.items')}
            </h2>
            <div className="space-y-3">
              {order.orderItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    {item.product.imageUrl ? (
                      <Image
                        src={item.product.imageUrl}
                        alt={item.product.title}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm sm:text-base font-semibold text-gray-900">
                        {item.product.title}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.delivered
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {item.delivered
                          ? t('my_orders.status.delivered')
                          : t('my_orders.status.in_delivery')}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Roast level: {item.product.roastLevel}
                      {item.product.grindType && (
                        <span> • Grind: {item.product.grindType}</span>
                      )}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-700">
                      <div>
                        Price:{' '}
                        <span className="font-medium">
                          {formatCurrency(item.product.price)}
                        </span>
                      </div>
                      <div>
                        Amount:{' '}
                        <span className="font-medium">{item.items}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">Line total</p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900">
                      {formatCurrency(item.product.price * item.items)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Order Total */}
          <section className="mb-6 border-t border-gray-200 pt-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
              Order Total
            </h2>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Items</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(itemsTotal)}
                </span>
              </div>
              {deliveryPrice > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {t('my_orders.delivery.label')}
                  </span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(deliveryPrice)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm sm:text-base font-bold border-t border-gray-200 pt-3 mt-3">
                <span>{t('my_orders.total')}</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </section>

          {/* Delivery Information */}
          {order.delivery && order.delivery.method && (
            <section className="mb-6 border-t border-gray-200 pt-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Delivery
              </h2>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <MapPinIcon className="w-5 h-5 text-gray-500" />
                  <h3 className="text-md font-semibold text-gray-900">
                    {order.delivery.method === 'HOME'
                      ? t('my_orders.delivery.home')
                      : t('my_orders.delivery.event')}
                  </h3>
                </div>
                {order.delivery.method === 'HOME' && (
                  <div className="text-sm text-gray-700 space-y-2">
                    
                    {/* Recipient */}
                    {(order.delivery.name || order.delivery.phone) && (
                      <div className="font-medium text-gray-900">
                        {order.delivery.name}
                        {order.delivery.phone && (
                          <span className="block text-xs text-gray-500">
                            {order.delivery.phone}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Address */}
                    <div className="leading-tight">
                      {order.delivery.address1 && <div>{order.delivery.address1}</div>}
                      {order.delivery.address2 && (
                        <div className="text-gray-500">{order.delivery.address2}</div>
                      )}
                    </div>

                    {/* Location */}
                    {(order.delivery.city || order.delivery.state || order.delivery.country) && (
                      <div className="text-gray-600">
                        {[order.delivery.city, order.delivery.state, order.delivery.country]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}

                  </div>
                )}

                {order.delivery.method === 'EVENT' &&
                  order.delivery.event &&
                  order.delivery.event.title && (
                    <div className="text-sm text-gray-600 space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        <p className="font-semibold">
                          {order.delivery.event.title}
                        </p>
                      </div>
                      {order.delivery.event.description && (
                        <p className="text-gray-600">
                          {order.delivery.event.description}
                        </p>
                      )}
                      {order.delivery.event.location && (
                        <p className="ml-6">{order.delivery.event.location}</p>
                      )}
                      {(() => {
                        const event = order.delivery.event as any
                        // Check if new fields exist (startAt, endAt, timezone, isAllDay)
                        if (event.startAt) {
                          return (
                            <p className="ml-6 text-gray-500">
                              {formatEventDateTime(
                                event.startAt as string,
                                event.endAt || null,
                                event.timezone || 'UTC',
                                event.isAllDay || false
                              )}
                            </p>
                          )
                        }
                        return null
                      })()}
                      {order.delivery.event.urlImage && (
                        <Image
                          src={order.delivery.event.urlImage}
                          alt={order.delivery.event.title || 'Event image'}
                          width={400}
                          height={250}
                          className="mt-2 w-full max-w-md rounded-lg"
                        />
                      )}
                    </div>
                  )}
              </div>
            </section>
          )}

          {/* Payment Transaction */}
          {order.paymentTx && (
            <section className="border-t border-gray-200 pt-4 mt-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                Payment TX Hash
              </h2>
              <p className="text-xs sm:text-sm text-gray-700 break-all">
                {order.paymentTx}
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
