import NextImage from 'next/image'
import { OrderItem } from '@/services/api/orders/types'


export function OrderItemsList({ orderItems, t }: { orderItems: OrderItem[], t: (key: string) => string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-6">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-black">
          {t('checkout.order_summary')}
        </h2>
      </div>

      <div className="divide-y divide-gray-200">
        {orderItems.map((item) => (
          <div key={item.id} className="p-4 flex gap-4">
            <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
              {item.product.imageUrl ? (
                <NextImage
                  src={item.product.imageUrl}
                  alt={item.product.title}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  No Image
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-black">{item.product.title}</h3>
              <p className="text-sm text-gray-600 mb-2">
                {item.product.farm?.name || ''} • {item.product.farm?.region || ''}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-600">
                  Qty: <strong>{item.items}</strong>
                </span>
                <span className="text-lg font-bold text-black">
                  ${(item.product.price * item.items).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
