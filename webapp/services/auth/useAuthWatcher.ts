'use client'

import { useEffect } from 'react'
import { authService } from './authService'

export function useAuthWatcher(refreshUser: () => void, clearUser: () => void) {

  // Try full session restoration on page load
  useEffect(() => {
    authService.restoreSessionFromRefreshToken().then(res => {
      if (res) refreshUser()
      else clearUser()
    })
  }, [])


  // Background token refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!authService.isAuthenticated()) return

      const refreshed = await authService.refreshAccessToken()

      if (refreshed) refreshUser()
      else clearUser()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [refreshUser])


  // Multi-tab + same-tab synchronization
  // Note: Access tokens are now in HttpOnly cookies, so we can't listen to storage events for them
  // We only listen to auth-change events and user storage changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // Listen for user data changes (not accessToken - it's in HttpOnly cookie)
      if (e.key === 'user') {
        e.newValue ? refreshUser() : clearUser()
      }
    }

    const onAuthChange = () => {
      authService.isAuthenticated() ? refreshUser() : clearUser()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('auth-change', onAuthChange)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('auth-change', onAuthChange)
    }
  }, [refreshUser, clearUser])
}
