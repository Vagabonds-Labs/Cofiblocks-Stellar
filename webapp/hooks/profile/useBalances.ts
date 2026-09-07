'use client'

import { useState, useEffect } from 'react'

import { onchainService } from '@/services/api/onchain'
import { formatBalance } from '@/utils/formatting'

/**
 * Balances de la cuenta. Sólo XLM y USDC: se fueron STRK, USDT y USDC.e junto
 * con el contrato de swap.
 *
 * `hasUsdcTrustline` importa porque sin trustline la cuenta no puede recibir
 * USDC — el backend ofrece crearla patrocinada.
 */
export function useBalances(user: any, loadingUser: boolean, t: any) {
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasUsdcTrustline, setHasUsdcTrustline] = useState(true)
  const [balances, setBalances] = useState({
    xlm: '0.00',
    usdc: '0.00',
  })

  const fetchBalances = async () => {
    if (!user?.walletAddress) return

    setLoadingBalances(true)
    setError(null)

    try {
      const res = await onchainService.getBalanceOf()

      setBalances({
        xlm: formatBalance(res.balances.XLM) || '0.00',
        usdc: formatBalance(res.balances.USDC) || '0.00',
      })
      setHasUsdcTrustline(res.trustlines.USDC)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || t('balances.error_loading'))
    } finally {
      setLoadingBalances(false)
    }
  }

  useEffect(() => {
    if (user?.walletAddress && !loadingUser) fetchBalances()
  }, [user?.walletAddress, loadingUser])

  return {
    balances,
    hasUsdcTrustline,
    loadingBalances,
    fetchBalances,
    balancesError: error,
  }
}
