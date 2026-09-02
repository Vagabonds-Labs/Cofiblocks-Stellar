'use client'

import { useEffect } from 'react'
import { authService } from '@/services/auth/authService'

export function usePendingCheckout(itemsLength: number, handleCheckout: () => void) {
  useEffect(() => {
    const check = () => {
      const pending = sessionStorage.getItem('pendingCheckout')
      const redirectFlag = sessionStorage.getItem('checkoutRedirect')

      if (
        pending === 'true' &&
        redirectFlag === 'true' &&
        authService.isAuthenticated() &&
        itemsLength > 0
      ) {
        sessionStorage.removeItem('pendingCheckout')
        sessionStorage.removeItem('checkoutRedirect')
        handleCheckout()
      }
    }

    check()

    const listener = () => setTimeout(check, 100)
    window.addEventListener('auth-change', listener)

    return () => window.removeEventListener('auth-change', listener)
  }, [itemsLength, handleCheckout])
}
