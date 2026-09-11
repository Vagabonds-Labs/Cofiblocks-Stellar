'use client'

import { useCallback, useEffect, useState } from 'react'

import { onchainService } from '@/services/api/onchain'
import { ensureUSDCTrustline } from '@/services/wallet/usdcTrustline'

/**
 * Alta de la trustline a USDC, patrocinada por el backend.
 *
 * Una cuenta de Stellar necesita trustline para poder recibir USDC, y abrirla
 * inmoviliza reservas en XLM. Las pone el backend, así un usuario nuevo puede
 * comprar café sin tener un solo XLM. Es el paso que en Starknet no existía.
 */
export function useUSDCTrustline(walletAddress: string | null) {
  const [isRequired, setIsRequired] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const check = useCallback(async () => {
    if (!walletAddress) return
    try {
      const { required } = await onchainService.getUSDCTrustline()
      setIsRequired(required)
    } catch (err) {
      console.error('Could not check USDC trustline', err)
    }
  }, [walletAddress])

  useEffect(() => {
    void check()
  }, [check])

  const createTrustline = useCallback(async () => {
    if (!walletAddress) return
    setIsCreating(true)
    setError(null)
    setErrorCode(null)
    try {
      await ensureUSDCTrustline(walletAddress)
      setIsRequired(false)
    } catch (err: any) {
      console.error('Could not create USDC trustline', err)
      setError(err.message || 'Could not create USDC trustline')
      // Con el código se puede explicar la causa, por ejemplo una wallet que
      // firmó para otra red (WRONG_NETWORK_SIGNATURE).
      setErrorCode(err?.code ?? null)
    } finally {
      setIsCreating(false)
    }
  }, [walletAddress])

  return { isRequired, isCreating, error, errorCode, createTrustline, refresh: check }
}
