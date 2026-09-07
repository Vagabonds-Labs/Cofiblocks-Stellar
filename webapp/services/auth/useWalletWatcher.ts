'use client'

import { useEffect } from 'react'
import { walletService } from '@/services/wallet/walletService'

/**
 * Vigila que la wallet conectada siga siendo la de la sesión.
 *
 * Ya no hay que distinguir entre proveedores: sólo se entra por wallet.
 */
export function useWalletWatcher(user: any, logoutCallback: () => void) {
  useEffect(() => {
    if (!user?.walletAddress) return

    const interval = setInterval(async () => {
      const address = await walletService.trySilent()
      if (!address) return

      if (address !== user.walletAddress) {
        console.warn('WalletWatcher: Wallet mismatch')
        logoutCallback()
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [user, logoutCallback])
}
