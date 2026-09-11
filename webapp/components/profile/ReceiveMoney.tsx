'use client'

import { useState } from 'react'
import QRCode from 'qrcode'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

import { ensureUSDCTrustline } from '@/services/wallet/usdcTrustline'
import { formatAddressForClipboard } from '@/utils/formatting'

/**
 * "Recibir dinero", para quien entró con email o Google.
 *
 * Reemplaza a la "dirección de wallet" y al aviso de trustline: al tocarlo,
 * habilitamos USDC en la cuenta sin que el usuario vea nada y recién ahí
 * mostramos el QR. Mostrar la dirección antes sería peligroso: un envío de USDC
 * a una cuenta sin trustline rebota.
 */
export function ReceiveMoney({
  walletAddress,
  onReady,
  t,
}: {
  walletAddress: string
  onReady?: () => void
  t: any
}) {
  const [state, setState] = useState<'idle' | 'preparing' | 'ready'>('idle')
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const open = async () => {
    setError(null)
    setState('preparing')
    try {
      const created = await ensureUSDCTrustline(walletAddress)
      if (created) onReady?.()
      setQr(await QRCode.toDataURL(walletAddress, { margin: 1, width: 200 }))
      setState('ready')
    } catch (err) {
      console.error('Could not prepare account to receive USDC', err)
      setError(t('balances.receive_error'))
      setState('idle')
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(formatAddressForClipboard(walletAddress))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (state !== 'ready') {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={open}
          disabled={state === 'preparing'}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-medium rounded-lg
                     hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="w-5 h-5" />
          {state === 'preparing' ? t('balances.receive_preparing') : t('balances.receive_button')}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 max-w-md">
      <p className="font-medium text-gray-900">{t('balances.receive_button')}</p>
      {qr && <img src={qr} alt="QR" className="w-48 h-48" />}
      <p className="font-mono text-xs break-all text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
        {walletAddress}
      </p>
      <button onClick={copy} className="text-sm text-orange-600 hover:text-orange-700">
        {copied ? t('balances.copied') : t('balances.copy_address')}
      </button>
      <p className="text-xs text-gray-500">{t('balances.receive_description')}</p>
    </div>
  )
}
