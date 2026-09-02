'use client'

import { ApiError } from '@/lib/api'
import { useCallback, useState } from 'react'
import { authService } from './authService'

export function useUserData() {
  const [user, setUser] = useState(authService.getCurrentUser())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // If not authenticated, try restoring from refresh cookie
      if (!authService.isAuthenticated()) {
        const restored = await authService.restoreSessionFromRefreshToken()
        if (!restored) {
          setUser(null)
          setLoading(false)
          return
        }
      }

      // If we have a token, load user from API
      const fetched = await authService.getCurrentUserFromApi()
      setUser(fetched)

    } catch (err) {
      const apiError = err as ApiError

      // Token expired or invalid → full logout
      if (apiError.statusCode === 401) {
        await authService.logout()
      }

      setUser(null)
      setError(apiError.message || 'Failed to load user')

    } finally {
      setLoading(false)
    }
  }, [])

  return { user, loading, error, loadUser, setUser }
}
