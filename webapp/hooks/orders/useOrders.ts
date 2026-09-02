'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { orderService, Order, OrderStatus } from '@/services/api/orders'

export function useOrders(statuses?: OrderStatus[]) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize statuses to prevent infinite loops - create a stable reference
  const memoizedStatuses = useMemo(() => {
    if (!statuses || statuses.length === 0) return undefined
    return [...statuses].sort() as OrderStatus[]
  }, [statuses?.join(',')])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await orderService.getOrders(memoizedStatuses)
      setOrders(response || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [memoizedStatuses])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  return { orders, loading, error, refetch: fetchOrders }
}

