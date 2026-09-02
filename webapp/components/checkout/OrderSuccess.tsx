import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { Order } from '@/services/api/orders/types'
import { formatEventDateTime } from '@/utils/formatting'
import { OrderItemsList } from './OrderItemsList'
import { SummaryCard } from './SummaryCard'

export interface OrderSuccessProps {
  order: Order
  t: (key: string) => string
  onOk: () => void
}

export function OrderSuccess({ order, t, onOk }: OrderSuccessProps) {
  const subtotal = order.orderItems.reduce((sum, item) => sum + item.product.price * item.items, 0)
  const totalItems = order.orderItems.reduce((sum, item) => sum + item.items, 0)
  const deliveryPrice = order.delivery?.price || null
  const totalPrice = subtotal + (deliveryPrice || 0)

  console.log('order delivery event', order.delivery?.event)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Success Header */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3">
          <CheckCircleIcon className="w-8 h-8 text-green-600 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-green-900">
              {t('checkout.order_completed')}
            </h1>
            <p className="text-green-700 mt-1">
              {t('checkout.order_completed_message')}
            </p>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-black mb-4">
          {t('checkout.order_details')}
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{t('checkout.order_id')}:</span>
            <span className="font-mono text-black">{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{t('checkout.order_status')}:</span>
            <span className="font-semibold text-black">{order.status}</span>
          </div>
          {order.paymentTx && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('checkout.payment_tx')}:</span>
              <span className="font-mono text-black text-xs break-all">{order.paymentTx}</span>
            </div>
          )}
        </div>
      </div>

      {/* Order Items */}
      <OrderItemsList orderItems={order.orderItems} t={t} />

      {/* Delivery Information */}
      {order.delivery && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-black mb-4">
            {t('checkout.delivery_information')}
          </h2>
          <div className="space-y-3">
            {order.delivery.method === 'EVENT' && order.delivery.event && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {t('checkout.pickup_at_event_success')}
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {order.delivery.event.title && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">{t('checkout.event_name')}:</span>
                      <span className="text-sm text-black ml-2">{order.delivery.event.title}</span>
                    </div>
                  )}
                  {order.delivery.event.location && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">{t('checkout.event_location')}:</span>
                      <span className="text-sm text-black ml-2">{order.delivery.event.location}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-600">{t('checkout.event_date')}:</span>
                    <span className="text-sm text-black ml-2">
                      {(() => {
                        const event = order.delivery.event as any
                        // Check if new fields exist (startAt, endAt, timezone, isAllDay)
                        if (event.startAt) {
                          return formatEventDateTime(
                            event.startAt as string,
                            event.endAt || null,
                            event.timezone || 'UTC',
                            event.isAllDay || false
                          )
                        }
                        return '-'
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {order.delivery.method === 'HOME' && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {t('checkout.home_delivery_success')}
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {order.delivery.address1 && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">{t('checkout.address')}:</span>
                      <span className="text-sm text-black ml-2">{order.delivery.address1}</span>
                    </div>
                  )}
                  {order.delivery.address2 && (
                    <div>
                      <span className="text-sm text-black ml-2">{order.delivery.address2}</span>
                    </div>
                  )}
                  {(order.delivery.city || order.delivery.state || order.delivery.country) && (
                    <div>
                      <span className="text-sm text-black">
                        {[order.delivery.city, order.delivery.state, order.delivery.country]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <SummaryCard
        subtotal={subtotal}
        totalItems={totalItems}
        deliveryPrice={deliveryPrice}
        totalPrice={totalPrice}
        t={t}
      />

      {/* OK Button */}
      <button
        onClick={onOk}
        className="w-full py-4 rounded-lg text-lg font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-colors"
      >
        {t('checkout.ok')}
      </button>
    </div>
  )
}

