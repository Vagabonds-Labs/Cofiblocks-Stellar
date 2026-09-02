'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSale } from '@/hooks/sells/useSale'
import { useUser } from '@/lib/providers/UserProvider'
import { OrderStatus } from '@/services/api/orders'
import { sellsService } from '@/services/api/sells'
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  TruckIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowLeftIcon,
  UserCircleIcon,
  EnvelopeIcon,
  WalletIcon
} from '@heroicons/react/24/outline'
import { useAdminOrder } from '@/hooks/admin/useAdminOrder'
import { adminService } from '@/services/api/admin'
import { formatEventDateTime } from '@/utils/formatting'

export default function SaleDetailPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const orderId = params.id as string
  const { user, loading: userLoading } = useUser()
  const { order, loading, error, refetch } = useAdminOrder(orderId)
  const [confirming, setConfirming] = useState(false)

  // Define status display configuration
  const statusConfig: Record<OrderStatus, { label: string; color: string; icon: any; description: string }> = {
    PENDING_PAYMENT: {
      label: t('my_orders.status.pending_payment'),
      color: 'yellow',
      icon: ClockIcon,
      description: t('my_orders.status_description.pending_payment')
    },
    PAID: {
      label: t('my_orders.status.paid'),
      color: 'blue',
      icon: CheckCircleIcon,
      description: t('my_orders.status_description.paid')
    },
    PENDING_DELIVERY_PAYMENT: {
      label: t('my_orders.status.pending_delivery_payment'),
      color: 'orange',
      icon: ClockIcon,
      description: t('my_orders.status_description.pending_delivery_payment')
    },
    IN_DELIVERY: {
      label: t('my_orders.status.in_delivery'),
      color: 'purple',
      icon: TruckIcon,
      description: t('my_orders.status_description.in_delivery')
    },
    DELIVERED: {
      label: t('my_orders.status.delivered'),
      color: 'green',
      icon: CheckCircleIcon,
      description: t('my_orders.status_description.delivered')
    },
    CANCELLED: {
      label: t('my_orders.status.cancelled'),
      color: 'red',
      icon: XCircleIcon,
      description: t('my_orders.status_description.cancelled')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusBadgeClass = (color: string) => {
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      blue: 'bg-blue-100 text-blue-800 border-blue-300',
      orange: 'bg-orange-100 text-orange-800 border-orange-300',
      purple: 'bg-purple-100 text-purple-800 border-purple-300',
      green: 'bg-green-100 text-green-800 border-green-300',
      red: 'bg-red-100 text-red-800 border-red-300'
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
      red: 'text-red-600'
    }
    return colorMap[color] || 'text-gray-600'
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
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
            onClick={() => router.push(`/${locale}/admin/orders`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>{t('my_sales.back_to_sales')}</span>
          </button>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || t('my_sales.sale_not_found')}
          </div>
        </main>
      </div>
    )
  }

  const config = statusConfig[order.status]
  const Icon = config.icon
  const total = order.orderItems.reduce((sum, item) => sum + (item.product.price * item.items), 0)
  const deliveryPrice = order.delivery?.price || 0
  const grandTotal = total + deliveryPrice

  const handleMarkAsDelivered = async () => {
    if (confirming) return
    setConfirming(true)
    try {
      await adminService.markOrderAsDelivered(orderId);
      await refetch();
    } catch (err) {
      console.error('Failed to confirm delivery:', err);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/${locale}/admin/orders`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>{t('my_sales.back_to_sales')}</span>
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {/* Header */}
          <div className="mb-6 space-y-4">
            {/* Order Number - Full width on mobile */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${getStatusIconClass(config.color)}`} />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {t('my_orders.order_prefix')}{order.id.slice(0, 8)}
              </h1>
            </div>
            
            {/* Status and Date - Stack on mobile, side by side on larger screens */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium border ${getStatusBadgeClass(config.color)}`}>
                  {config.label}
                </span>
                <p className="text-xs sm:text-sm text-gray-500 sm:hidden">{config.description}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500">{t('my_orders.order_date')}</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900">{formatDate(order.createdAt)}</p>
              </div>
            </div>
            
            {/* Description - Hidden on mobile, shown on larger screens */}
            <p className="hidden sm:block text-xs sm:text-sm text-gray-500">{config.description}</p>
          </div>

          {/* Buyer Information */}
          {(order.buyerName || order.buyerEmail || order.buyerWalletAddress) && (
            <div className="mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <UserCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {t('my_sales.buyer_information') ?? 'Buyer Information'}
                </h3>
              </div>
              <div className="text-sm text-gray-700 space-y-2">
                {order.buyerName && (
                  <div className="flex items-start gap-2">
                    <UserCircleIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">{t('my_sales.buyer_name') ?? 'Name'}</p>
                      <p className="font-medium text-gray-900">{order.buyerName}</p>
                    </div>
                  </div>
                )}
                {order.buyerEmail && (
                  <div className="flex items-start gap-2">
                    <EnvelopeIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500">{t('my_sales.buyer_email') ?? 'Email'}</p>
                      <p className="font-medium text-gray-900 break-all">{order.buyerEmail}</p>
                    </div>
                  </div>
                )}
                {order.buyerWalletAddress && (
                  <div className="flex items-start gap-2">
                    <WalletIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500">{t('my_sales.buyer_wallet') ?? 'Wallet Address'}</p>
                      <p className="font-mono text-xs sm:text-sm font-medium text-gray-900 break-all">
                        {order.buyerWalletAddress}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">{t('my_orders.items')}</h2>
            <div className="space-y-3">
              {order.orderItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    {item.product.imageUrl && (
                      <img 
                        src={item.product.imageUrl} 
                        alt={item.product.title}
                        className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{item.product.title}</p>
                        {item.delivered ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
                            {t('my_sales.delivered')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 flex-shrink-0">
                            {t('my_sales.pending_delivery')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500">{item.product.farm.name} • {item.items}x</p>
                      {item.product.description && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">{
                          item.product.description.slice(0, 20)}...
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-xs sm:text-sm text-gray-500">{t('my_orders.subtotal')}</p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900">{formatCurrency(item.product.price * item.items)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Information */}
          {order.delivery && order.delivery.method && (
            <div className="mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {order.delivery.method === 'HOME' ? t('my_orders.delivery.home') : t('my_orders.delivery.event')}
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
              {order.delivery.method === 'EVENT' && order.delivery.event && order.delivery.event.title && (
                <div className="text-xs sm:text-sm text-gray-600 space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <p className="text-sm sm:text-base font-semibold">{order.delivery.event.title}</p>
                  </div>
                  {order.delivery.event.description && (
                    <p className="text-gray-600">{order.delivery.event.description}</p>
                  )}
                  {order.delivery.event.location && (
                    <p className="ml-5 sm:ml-6">{order.delivery.event.location}</p>
                  )}
                  {(() => {
                    const event = order.delivery.event as any
                    // Check if new fields exist (startAt, endAt, timezone, isAllDay)
                    if (event.startAt) {
                      return (
                        <p className="ml-5 sm:ml-6 text-gray-500">
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
                    <img 
                      src={order.delivery.event.urlImage} 
                      alt={order.delivery.event.title || 'Event image'}
                      className="mt-2 w-full max-w-md rounded-lg"
                    />
                  )}
                </div>
              )}
              {order.delivery.price && order.delivery.price > 0 && (
                <p className="text-xs sm:text-sm font-medium text-gray-900 mt-3">
                  {t('my_orders.delivery.label')} {formatCurrency(order.delivery.price)}
                </p>
              )}
            </div>
          )}

          {/* Order Summary */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">{t('my_sales.order_summary')}</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-600">{t('my_orders.subtotal')}</span>
                <span className="font-medium text-gray-900">{formatCurrency(total)}</span>
              </div>
              {deliveryPrice > 0 && (
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-gray-600">{t('my_orders.delivery.label')}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(deliveryPrice)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-base sm:text-lg font-bold border-t border-gray-200 pt-3 mt-3">
                <span>{t('my_orders.total')}</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Transaction */}
          {order.paymentTx && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs sm:text-sm text-gray-500 break-all">
                <span className="font-medium">{t('my_orders.payment_tx')}</span> {order.paymentTx}
              </p>
              {order.isStripeOrder && (
                <div className="mt-2 inline-flex items-center px-3 py-1.5 rounded-lg bg-violet-100 border border-violet-200">
                  <span className="text-xs sm:text-sm font-medium text-violet-800">
                    {t('my_orders.paid_with_stripe', { defaultValue: 'Paid with Stripe' })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Confirm Delivery Button */}
          {order.orderItems.some(item => !item.delivered) && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleMarkAsDelivered}
                disabled={confirming}
                className={`
                  w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium 
                  hover:bg-green-700 transition-colors
                  ${confirming ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {confirming ? t('my_sales.confirming_delivery') : t('my_sales.confirm_delivery')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

