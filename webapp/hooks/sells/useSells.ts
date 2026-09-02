'use client'

import { useState, useEffect, useCallback } from 'react'
import { sellsService } from '@/services/api/sells'
import { Order } from '@/services/api/orders'

export function useSells() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSells = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await sellsService.getSells()
      setOrders(response || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSells()
  }, [fetchSells])

  return { orders, loading, error, refetch: fetchSells }
}

