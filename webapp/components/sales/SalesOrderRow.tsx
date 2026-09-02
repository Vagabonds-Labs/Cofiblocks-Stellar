'use client'

import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Order, OrderStatus } from '@/services/api/orders'
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  TruckIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'

interface SalesOrderRowProps {
  order: Order
  onClick?: () => void
}

export function SalesOrderRow({ order, onClick }: SalesOrderRowProps) {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      router.push(`/${locale}/seller/my-sales/${order.id}`)
    }
  }

  // Define status display configuration
  const statusConfig: Record<OrderStatus, { label: string; color: string; icon: any }> = {
    PENDING_PAYMENT: {
      label: t('my_orders.status.pending_payment'),
      color: 'yellow',
      icon: ClockIcon,
    },
    PAID: {
      label: t('my_orders.status.paid'),
      color: 'blue',
      icon: CheckCircleIcon,
    },
    PENDING_DELIVERY_PAYMENT: {
      label: t('my_orders.status.pending_delivery_payment'),
      color: 'orange',
      icon: ClockIcon,
    },
    IN_DELIVERY: {
      label: t('my_orders.status.in_delivery'),
      color: 'purple',
      icon: TruckIcon,
    },
    DELIVERED: {
      label: t('my_orders.status.delivered'),
      color: 'green',
      icon: CheckCircleIcon,
    },
    CANCELLED: {
      label: t('my_orders.status.cancelled'),
      color: 'red',
      icon: XCircleIcon,
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

  const config = statusConfig[order.status]
  const Icon = config.icon
  const total = order.orderItems.reduce((sum, item) => sum + (item.product.price * item.items), 0)
  const deliveryPrice = order.delivery?.price || 0
  const grandTotal = total + deliveryPrice

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 hover:shadow-md hover:border-green-500 transition-all cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left side: Order ID, Date, Delivery, Status */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 flex-1 min-w-0">
          <div className="min-w-0 sm:min-w-[120px]">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">{t('my_orders.order_prefix')}</p>
            <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{order.id.slice(0, 8)}</p>
          </div>
          
          <div className="min-w-0 sm:min-w-[180px]">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">{t('my_orders.order_date')}</p>
            <p className="text-xs sm:text-sm text-gray-900">{formatDate(order.createdAt)}</p>
          </div>

          {/* Delivery Type */}
          {order.delivery?.method && (
            <div className="min-w-0 sm:min-w-[100px]">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">{t('my_orders.delivery.label')}</p>
              <p className="text-xs sm:text-sm text-gray-900">
                {order.delivery.method === 'HOME' 
                  ? t('my_orders.delivery.home') 
                  : t('my_orders.delivery.event')}
              </p>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${getStatusIconClass(config.color)}`} />
            <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(config.color)}`}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Right side: Total and chevron */}
        <div className="flex items-center justify-between sm:justify-end gap-4 sm:flex-shrink-0">
          <div className="text-left sm:text-right">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">{t('my_orders.total')}</p>
            <p className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(grandTotal)}</p>
          </div>
          
          <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </div>
      </div>
    </div>
  )
}

