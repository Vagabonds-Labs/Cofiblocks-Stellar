'use client'

import { useTranslations } from 'next-intl'
import { Order } from '@/services/api/orders'
import { SalesOrderRow } from './SalesOrderRow'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

interface CompletedOrdersProps {
  orders: Order[]
}

export function CompletedOrders({ orders }: CompletedOrdersProps) {
  const t = useTranslations()

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-600 text-lg">{t('my_sales.no_completed')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <CheckCircleIcon className="w-6 h-6 text-green-600" />
        <h2 className="text-2xl font-semibold text-gray-900">
          {t('my_sales.completed')}
        </h2>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
          {orders.length}
        </span>
      </div>
      <div className="space-y-3">
        {orders.map((order) => (
          <SalesOrderRow key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}

