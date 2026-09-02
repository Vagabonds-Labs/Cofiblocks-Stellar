'use client'

import { useTranslations } from 'next-intl'
import { FilterType, useMyOrders } from '@/hooks/orders/useMyOrders'
import { useRouter } from 'next/navigation'
import { OrderCard } from '@/components/orders/OrderCard'
import { OrdersTabs } from '@/components/orders/OrdersTabs'

export default function MyOrdersPage() {
  const t = useTranslations()
  const router = useRouter()
  const {
    activeFilter,
    setActiveFilter,
    orders,
    groupedOrders,
    loading,
    error,
    refetch,
  } = useMyOrders()

  const handleOrderClick = (orderId: string) => {
    router.push(`/my-orders/${orderId}`)
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {t('my_orders.title')}
      </h1>

      {/* Tabs (always rendered) */}
      <OrdersTabs
        activeFilter={activeFilter}
        onChange={(filter) => setActiveFilter(filter as FilterType)}
      />

      {/* Content under tabs */}
      {loading && (
        <p className="text-center text-gray-500 pb-12">
          {t('my_orders.loading')}
        </p>
      )}

      {error && (
        <p className="text-center text-red-600 pb-12">
          {error}
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="text-center text-gray-500 pb-12">
          {t('my_orders.no_orders')}
        </p>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="space-y-4">
          {Object.values(groupedOrders)
            .flat()
            .map(order => (
              <OrderCard key={order.id} order={order} onDelete={refetch} onClick={handleOrderClick} />
            ))}
        </div>
      )}
    </main>
  )
}
