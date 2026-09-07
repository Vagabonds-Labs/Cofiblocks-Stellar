'use client'

import { useState, useEffect, useCallback } from 'react'

import { authService } from '@/services/auth'
import { walletService } from '@/services/wallet/walletService'

/**
 * Login por firma de wallet.
 *
 * El flujo cambió respecto de Starknet: ya no se firma un typed data SNIP-12 ni
 * se verifica contra el contrato de cuenta del usuario. Acá el backend emite un
 * nonce de un solo uso, la wallet firma el mensaje en formato SEP-53 y el
 * backend lo verifica en local con la clave pública ed25519.
 */
export function useWalletLogin() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reconexión silenciosa si el usuario ya había elegido una wallet.
  useEffect(() => {
    let cancelled = false

    walletService
      .trySilent()
      .then((connected) => {
        if (cancelled || !connected) return
        setAddress(connected)
        setIsRegistered(authService.isAuthenticated())
      })
      .catch((err) => console.error(err))

    return () => {
      cancelled = true
    }
  }, [])

  /** Abre el modal y devuelve la dirección, sin pedir firma. */
  const connectWalletWithoutSignature = useCallback(async () => {
    const connected = await walletService.connect()
    setAddress(connected)
    return connected
  }, [])

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const connected = await walletService.connect()

      // El nonce lo emite el backend: una firma vieja no sirve dos veces.
      const { nonce, message } = await authService.requestNonce(connected)
      const signature = await walletService.signMessage(message, connected)

      await authService.registerWallet(connected, signature, nonce)

      setAddress(connected)
      setIsRegistered(true)
    } catch (err: any) {
      console.error('Wallet login failed', err)
      setError(err.message || 'Wallet login failed')
      await walletService.disconnect()
      setAddress(null)
      setIsRegistered(false)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnectWallet = useCallback(async () => {
    await walletService.disconnect()
    setAddress(null)
    setIsRegistered(false)
  }, [])

  return {
    address,
    isRegistered,
    isConnecting,
    error,
    connectWalletWithoutSignature,
    connectWallet,
    disconnectWallet,
  }
}
