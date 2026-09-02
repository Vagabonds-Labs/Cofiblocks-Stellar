import { useState, useMemo } from 'react'
import { Order, OrderStatus } from '@/services/api/orders'
import { useOrders } from '@/hooks/orders/useOrders'
import { filterConfig } from '@/config/myOrdersConfig'

export type FilterType = keyof typeof filterConfig

export function useMyOrders() {
  const [activeFilter, setActiveFilter] =
    useState<FilterType>('pending_action')

  const statuses = useMemo(
    () => filterConfig[activeFilter].statuses,
    [activeFilter]
  )

  const { orders, loading, error, refetch } = useOrders(statuses)

  const groupedOrders = useMemo(() => {
    return orders.reduce((acc, order) => {
      acc[order.status] ||= []
      acc[order.status].push(order)
      return acc
    }, {} as Record<OrderStatus, Order[]>)
  }, [orders])

  return {
    activeFilter,
    setActiveFilter,
    orders,
    groupedOrders,
    loading,
    error,
    refetch,
  }
}
