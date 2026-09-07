'use client'

import { useCallback, useEffect, useState } from 'react'

import { onchainService } from '@/services/api/onchain'
import { walletService } from '@/services/wallet/walletService'

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
    try {
      const { required, tx } = await onchainService.getUSDCTrustline()
      if (!required || !tx) {
        setIsRequired(false)
        return
      }
      // El backend ya firmó como patrocinador; falta la firma del usuario.
      const signedXdr = await walletService.signTransactionAs(tx, walletAddress)
      await onchainService.submitUSDCTrustline(signedXdr)
      setIsRequired(false)
    } catch (err: any) {
      console.error('Could not create USDC trustline', err)
      setError(err.message || 'Could not create USDC trustline')
    } finally {
      setIsCreating(false)
    }
  }, [walletAddress])

  return { isRequired, isCreating, error, createTrustline, refresh: check }
}
