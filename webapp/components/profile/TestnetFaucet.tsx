'use client'

import { useState } from 'react'

import { onchainService } from '@/services/api/onchain'
import type { ApiError } from '@/lib/api/types'

/**
 * Botón de USDC de prueba. Sólo aparece en testnet: es el reemplazo del
 * "Get $100 Sepolia Tokens" que había con Starknet.
 *
 * Necesita la trustline a USDC — sin ella la cuenta no puede recibirlo — así
 * que queda deshabilitado hasta que el usuario la habilite.
 */
export function TestnetFaucet({
  hasUsdcTrustline,
  onFunded,
  t,
}: {
  hasUsdcTrustline: boolean
  onFunded?: () => void
  t: any
}) {
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'testnet') return null

  const handleClick = async () => {
    setIsSending(true)
    setMessage(null)
    try {
      await onchainService.requestTestnetUSDC()
      setMessage({ ok: true, text: t('balances.testnet_faucet_success') })
      onFunded?.()
    } catch (err) {
      const code = (err as ApiError)?.code
      setMessage({
        ok: false,
        text:
          code && t.has?.(`api_errors.${code}`)
            ? t(`api_errors.${code}`)
            : t('balances.testnet_faucet_error'),
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 my-6">
      <button
        onClick={handleClick}
        disabled={isSending || !hasUsdcTrustline}
        className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isSending ? t('balances.testnet_faucet_sending') : t('balances.testnet_faucet_button')}
      </button>
      {!hasUsdcTrustline && (
        <p className="text-xs text-gray-500">{t('balances.testnet_faucet_needs_trustline')}</p>
      )}
      {message && (
        <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</p>
      )}
    </div>
  )
}
