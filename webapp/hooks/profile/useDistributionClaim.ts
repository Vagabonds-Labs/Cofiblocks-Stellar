'use client'

import { useCallback, useEffect, useState } from 'react'

import { onchainService } from '@/services/api/onchain'
import type { ClaimableRole, RoleBalance } from '@/services/api/onchain/types'
import { walletService } from '@/services/wallet/walletService'

/**
 * Reparto de utilidades: saldos del usuario y su reclamo.
 *
 * CofiBlocks reparte una parte de la ganancia entre quienes participan: el
 * coffee lover que compró, el productor y el tostador. El admin dispara el
 * reparto y acá cada quien cobra lo suyo.
 *
 * La transacción la firma el usuario, no el backend: el contrato transfiere el
 * USDC al `caller`, así que tiene que autorizar él.
 */
export function useDistributionClaim(walletAddress: string | null) {
  const [balances, setBalances] = useState<RoleBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [claimingRole, setClaimingRole] = useState<ClaimableRole | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!walletAddress) return
    setLoading(true)
    try {
      setBalances(await onchainService.getDistributionBalances())
    } catch (err) {
      console.error('Could not load distribution balances', err)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const claim = useCallback(
    async (role: ClaimableRole) => {
      if (!walletAddress) return
      setClaimingRole(role)
      setError(null)
      setLastTxHash(null)
      try {
        const prepared = await onchainService.getDistributionClaim(role)
        const signedXdr = await walletService.signTransactionAs(prepared, walletAddress)
        const { tx_hash } = await onchainService.submitDistributionClaim(role, signedXdr)
        setLastTxHash(tx_hash)
        await refresh()
      } catch (err: any) {
        console.error('Could not claim distribution balance', err)
        setError(err.message || 'Could not claim distribution balance')
      } finally {
        setClaimingRole(null)
      }
    },
    [walletAddress, refresh]
  )

  const claimable = balances.filter((b) => b.usd > 0)

  return { balances, claimable, loading, claimingRole, error, lastTxHash, claim, refresh }
}
