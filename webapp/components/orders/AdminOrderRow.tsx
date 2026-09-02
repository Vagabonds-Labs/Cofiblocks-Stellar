import { useState } from 'react'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'
import { Order } from '@/services/api/orders'
import { formatCurrency, formatDate } from '@/utils/formatting'
import { useTranslations } from 'next-intl'
import { adminService } from '@/services/api/admin/service'

interface AdminOrderRowProps {
  order: Order
  onMarkAsDelivered?: () => void
}

export function AdminOrderRow({ order, onMarkAsDelivered }: AdminOrderRowProps) {
  const t = useTranslations()
  const [markingAsDelivered, setMarkingAsDelivered] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)

  // Status config
  const statusConfig = {
    PENDING_PAYMENT: {
      label: t('my_orders.status.pending_payment'),
      icon: ClockIcon,
      color: 'text-yellow-600',
    },
    PAID: {
      label: t('my_orders.status.paid'),
      icon: CheckCircleIcon,
      color: 'text-blue-600',
    },
    PENDING_DELIVERY_PAYMENT: {
      label: t('my_orders.status.pending_delivery_payment'),
      icon: ClockIcon,
      color: 'text-yellow-600',
    },
    IN_DELIVERY: {
      label: t('my_orders.status.in_delivery'),
      icon: TruckIcon,
      color: 'text-blue-600',
    },
    DELIVERED: {
      label: t('my_orders.status.delivered'),
      icon: CheckCircleIcon,
      color: 'text-green-600',
    },
    CANCELLED: {
      label: t('my_orders.status.cancelled'),
      icon: XCircleIcon,
      color: 'text-red-600',
    },
  } as const

  const statusInfo = statusConfig[order.status]
  const Icon = statusInfo.icon

  // Calculate totals
  const total = order.orderItems.reduce(
    (sum, item) => sum + item.product.price * item.items,
    0
  )
  const deliveryPrice = order.delivery?.price || 0
  const grandTotal = total + deliveryPrice

  // Format delivery method
  const deliveryMethodLabel = order.delivery?.method === 'EVENT' ? 'Event' : order.delivery?.method === 'HOME' ? 'Home' : 'N/A'

  // Get delivery location info
  const deliveryLocation = order.delivery
    ? [order.delivery.country, order.delivery.state, order.delivery.city]
        .filter(Boolean)
        .join(', ')
    : null

  // Check if order can be marked as delivered
  const canMarkAsDelivered = order.status === 'PAID' || order.status === 'IN_DELIVERY'

  const handleMarkAsDelivered = async () => {
    if (!canMarkAsDelivered) return

    setMarkingAsDelivered(true)
    setMarkError(null)

    try {
      await adminService.markOrderAsDelivered(order.id)
      // Refetch orders after successfully marking as delivered
      if (onMarkAsDelivered) {
        await onMarkAsDelivered()
      }
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : 'Failed to mark order as delivered')
    } finally {
      setMarkingAsDelivered(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      {/* Header with order number and status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${statusInfo.color}`} />
          <div>
            <h3 className="font-semibold text-gray-900">
              Order #{order.id.slice(0, 8)}
            </h3>
            <p className="text-sm text-gray-500">ID: {order.id}</p>
            <p className="text-sm text-gray-500">Buyer ID: {order.buyerId}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </div>
          <div className="text-xs text-gray-500">
            {formatDate(order.createdAt)}
          </div>
        </div>
      </div>

      {/* Order details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Delivery Method */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Delivery Method</p>
          <p className="text-sm font-medium text-gray-900">{deliveryMethodLabel}</p>
        </div>

        {/* Event Title (if event delivery) */}
        {order.delivery?.event?.title && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Event</p>
            <p className="text-sm font-medium text-gray-900">
              {order.delivery.event.title}
            </p>
          </div>
        )}

        {/* Delivery Location (if home delivery) */}
        {deliveryLocation && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Delivery Location</p>
            <p className="text-sm font-medium text-gray-900">{deliveryLocation}</p>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="border-t border-gray-200 pt-4 mb-4">
        <p className="text-xs text-gray-500 mb-2">Order Items</p>
        {order.orderItems.map((item) => (
          <div key={item.id} className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">
              {item.product.title} × {item.items}
            </span>
            <span className="text-gray-900 font-medium">
              {formatCurrency(item.product.price * item.items)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {order.orderItems.length} item{order.orderItems.length !== 1 ? 's' : ''}
        </div>
        <div className="text-right">
          {deliveryPrice > 0 && (
            <div className="text-sm text-gray-600 mb-1">
              Subtotal: {formatCurrency(total)}
            </div>
          )}
          <div className="text-lg font-bold text-gray-900">
            Total: {formatCurrency(grandTotal)}
          </div>
        </div>
      </div>

      {/* Mark as Delivered Button */}
      {canMarkAsDelivered && (
        <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
          {markError && (
            <div className="text-sm text-red-600 mr-4 flex items-center">
              {markError}
            </div>
          )}
          <button
            onClick={handleMarkAsDelivered}
            disabled={markingAsDelivered}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
          >
            {markingAsDelivered ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Marking...
              </>
            ) : (
              'Mark as Delivered'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

