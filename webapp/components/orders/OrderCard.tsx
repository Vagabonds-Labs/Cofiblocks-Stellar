import {
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    TruckIcon,
    TrashIcon,
  } from '@heroicons/react/24/outline'
  import { Order, orderService } from '@/services/api/orders'
  import { formatCurrency } from '@/utils/formatting'
  import { useRouter, useParams } from 'next/navigation'
  import { useTranslations } from 'next-intl'
  import { useState } from 'react'
  
  export function OrderCard({
    order,
    onDelete,
    onClick,
    showStripeLabel = false,
  }: {
    order: Order
    onDelete?: () => void
    onClick?: (orderId: string) => void
    showStripeLabel?: boolean
  }) {
    const t = useTranslations()
    const router = useRouter()
    const params = useParams()
    const locale = params.locale as string
    const [isDeleting, setIsDeleting] = useState(false)

    const handleClick = () => {
      if (onClick) {
        onClick(order.id)
      } else {
        router.push(`/${locale}/my-orders/${order.id}`)
      }
    }
  
    // ---- status config (kept local, readable) ----
    const statusConfig = {
      PENDING_PAYMENT: {
        label: t('my_orders.status.pending_payment'),
        icon: ClockIcon,
      },
      PAID: {
        label: t('my_orders.status.paid'),
        icon: CheckCircleIcon,
      },
      PENDING_DELIVERY_PAYMENT: {
        label: t('my_orders.status.pending_delivery_payment'),
        icon: ClockIcon,
      },
      IN_DELIVERY: {
        label: t('my_orders.status.in_delivery'),
        icon: TruckIcon,
      },
      DELIVERED: {
        label: t('my_orders.status.delivered'),
        icon: CheckCircleIcon,
      },
      CANCELLED: {
        label: t('my_orders.status.cancelled'),
        icon: XCircleIcon,
      },
    } as const
  
    const Icon = statusConfig[order.status].icon
  
    const total = order.orderItems.reduce(
      (sum, item) => sum + item.product.price * item.items,
      0
    )
    const deliveryPrice = order.delivery?.price || 0
    const grandTotal = total + deliveryPrice
  
    const requiresAction =
      order.status === 'PENDING_PAYMENT' ||
      order.status === 'PENDING_DELIVERY_PAYMENT'

    const canDelete = order.status === 'PENDING_PAYMENT'

    const handleDelete = async () => {
      if (!canDelete || isDeleting) return
      
      if (!confirm(t('my_orders.confirm_delete'))) {
        return
      }

      setIsDeleting(true)
      try {
        await orderService.deletePendingPaymentOrder(order.id)
        onDelete?.()
      } catch (error) {
        console.error('Failed to delete order:', error)
        alert(t('my_orders.delete_error'))
      } finally {
        setIsDeleting(false)
      }
    }
  
    return (
      <div 
        className="bg-white rounded-lg border p-6 cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:shadow-md hover:border-gray-300" 
        onClick={handleClick}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5" />
            <div>
              <h3 className="font-semibold">
                {t('my_orders.order_prefix')}
                {order.id.slice(0, 8)}
              </h3>
              <div className="text-xs text-gray-500 mt-0.5">
                {new Date(order.createdAt).toLocaleDateString()}
                {order.delivery?.method && (
                  <>
                    {' • '}
                    {order.delivery.method === 'HOME'
                      ? t('my_orders.delivery.home')
                      : t('my_orders.delivery.event')}
                  </>
                )}
                {showStripeLabel && order.isStripeOrder && (
                  <span className="ml-1.5 inline-flex items-center rounded bg-[#635BFF]/15 px-1.5 py-0.5 text-xs font-medium text-[#635BFF]">
                    {t('my_orders.paid_with_stripe')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              disabled={isDeleting}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('my_orders.delete_order')}
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>
  
        {/* items */}
        {order.orderItems.map(item => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.product.title} × {item.items}
            </span>
            <span>
              {formatCurrency(item.product.price * item.items)}
            </span>
          </div>
        ))}
  
        <div className="mt-4 font-bold">
          Total: {formatCurrency(grandTotal)}
        </div>
  
        {requiresAction && (
          <button
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/${locale}/checkout/${order.id}`)
            }}
          >
            {t('my_orders.button_continue_checkout')}
          </button>
        )}
      </div>
    )
  }
  