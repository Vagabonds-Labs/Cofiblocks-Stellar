'use client'

import { useState, useEffect, useCallback } from 'react'
import { sellsService } from '@/services/api/sells'
import { OrderWithBuyer } from '@/services/api/orders'

export function useSale(orderId: string) {
  const [order, setOrder] = useState<OrderWithBuyer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSale = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await sellsService.getSaleById(orderId)
      setOrder(response)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchSale()
  }, [fetchSale])

  return { order, loading, error, refetch: fetchSale }
}

