'use client'

import { useEffect, useState, useRef } from 'react'
import { authService } from '@/services/auth'
import { buildSignatureTypedData } from '../../utils/signature'
import { useOptionalCavos } from './useOptionalCavos'

export function useCavosLogin() {
  const {
    cavos: {
      login,
      sendMagicLink,
      isAuthenticated,
      user,
      isLoading: cavosIsLoading,
      address,
      signMessage,
    },
    isCavosAvailable,
    unavailableMessage,
  } = useOptionalCavos()

  const [isRegistered, setIsRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const didCheck = useRef(false)

  const loginWithMagicLink = async (email: string) => {
    if (!isCavosAvailable) {
      const message = unavailableMessage || 'Cavos login is currently unavailable'
      setError(message)
      throw new Error(message)
    }

    setError(null)
    setMagicLinkSent(false)
    try {
      await sendMagicLink(email)
      setMagicLinkSent(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to send magic link')
      throw err
    }
  }

  // Automatically register Cavos users
  useEffect(() => {
    async function register() {
      if (!isCavosAvailable) return
      if (!isAuthenticated || !address) return

      if (didCheck.current) return
      didCheck.current = true

      if (authService.isAuthenticated()) {
        setIsRegistered(true)
        return
      }

      setIsRegistering(true)
      setError(null)
      
      try {
        // Create authentication message (nonce)
        // Typed data
        const typedData = buildSignatureTypedData()
        
        // Sign message with Cavos
        // @ts-ignore - Cavos signMessage accepts string but types may not reflect this yet
        const signature: string[] = await signMessage(typedData)
        
        // Convert signature to hex strings [r_hex, s_hex]
        // Handle both string and bigint formats
        const r = signature[1]
        const s = signature[2]
        
        // Register with backend using the signature
       const res = await authService.registerWallet(address, signature, typedData.message.nonce, 'cavos')
       if (res.message && !res.message.includes('login')) {
          // new user, try to update user email and name
          try {
              if (user?.email) {
                let userData: { email: string, name?: string } = { email: user.email }
                if (user.name) {
                  userData.name = user.name
                }
                await authService.updateUser(userData)
              }
          } catch (e: any) {
            // ignore errors updating user email
            console.error(e)
          }
       }

        setIsRegistered(true)
      } catch (e: any) {
        console.error(e)
        setError(e.message || 'Cavos registration failed')
        didCheck.current = false
      } finally {
        setIsRegistering(false)
      }
    }

    register()
  }, [isCavosAvailable, isAuthenticated, address, signMessage, user])

  // Combined loading state: either Cavos is loading or we're registering
  const isLoading = cavosIsLoading || isRegistering

  return {
    login,
    sendMagicLink,
    loginWithMagicLink,
    isAuthenticated,
    isRegistered,
    error,
    isLoading,
    magicLinkSent,
    isCavosAvailable,
  }
}
