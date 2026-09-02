'use client'

import { useState, useEffect, useCallback } from 'react'
import { farmService, Farm } from '@/services/api/farms'
import { useUser } from '@/lib/providers/UserProvider'

export function useFarms() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useUser()

  const fetchFarms = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (user?.sellerType === 'ROASTER') {
        const response = await farmService.getAllFarms()
        setFarms(response || [])
      } else if (user?.sellerType === 'PRODUCER') {
        const response = await farmService.getMyFarms()
        setFarms(response || [])
      } else {
        setFarms([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFarms()
  }, [fetchFarms])

  return { farms, loading, error, refetch: fetchFarms }
}

