'use client'

import { useState, useEffect } from 'react'

import { onchainService } from '@/services/api/onchain'
import { formatBalance } from '@/utils/formatting'
import { PaymentToken } from '@/types/contracts'

export function useBalances(user: any, loadingUser: boolean, t: any) {
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balances, setBalances] = useState({
    starks: '0.00',
    usdt: '0.00',
    usdc: '0.00',
    usdc_bridged: '0.00',
  })

  const fetchBalances = async () => {
    if (!user?.walletAddress) return

    setLoadingBalances(true)
    setError(null)

    try {
      const res = await onchainService.getBalanceOf()

      setBalances({
        starks: formatBalance(res.balances.STRK, PaymentToken.STRK) || '0.00',
        usdt: formatBalance(res.balances.USDT, PaymentToken.USDT) || '0.00',
        usdc: formatBalance(res.balances.USDC, PaymentToken.USDC) || '0.00',
        usdc_bridged: formatBalance(res.balances.USDC_BRIDGED, PaymentToken.USDC) || '0.00',
      })

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
    loadingBalances,
    fetchBalances,
    balancesError: error,
  }
}
