'use client'

import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSignRawHash } from '@privy-io/react-auth/extended-chains'

import { privySigner } from '@/services/wallet/privySigner'
import { findStellarWallet } from '@/hooks/auth/usePrivyLogin'

/**
 * Expone la sesión de Privy a `walletService`.
 *
 * No renderiza nada: cada vez que Privy restaura o cierra la sesión, registra o
 * borra el firmante en `privySigner`.
 */
export function PrivyBridge() {
  const { ready, authenticated, user, logout } = usePrivy()
  const { signRawHash } = useSignRawHash()

  useEffect(() => {
    if (!ready) return
    const address = authenticated ? findStellarWallet(user)?.address : undefined
    if (address) {
      privySigner.register({ address, signRawHash, logout })
    } else {
      privySigner.clear()
    }
  }, [ready, authenticated, user, signRawHash, logout])

  return null
}
