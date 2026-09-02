'use client'

import { useState, useEffect, useCallback } from 'react'
import { OrderWithBuyer } from '@/services/api/orders'
import { adminService } from '@/services/api/admin'

export function useAdminOrder(orderId: string) {
  const [order, setOrder] = useState<OrderWithBuyer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAdminOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await adminService.getOrderById(orderId)
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
    fetchAdminOrder()
  }, [fetchAdminOrder])

  return { order, loading, error, refetch: fetchAdminOrder }
}

