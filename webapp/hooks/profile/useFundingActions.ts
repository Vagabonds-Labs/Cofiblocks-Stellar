'use client'

import { useState } from 'react'

export function useFundingActions(user: any, getOnramp: any, t: any) {
  const [error, setError] = useState<string | null>(null)

  const handleFundByCard = () => {
    if (user?.walletProvider !== 'cavos') return

    try {
      const url = getOnramp('RAMP_NETWORK')
      window.open(url, '_blank')
    } catch (err) {
      console.error(err)
      setError(t('fund.error_onramp'))
    }
  }

  const handleFundByBridge = () => {
    alert('Bridge coming soon!')
  }

  return { handleFundByCard, handleFundByBridge, error, setError }
}
