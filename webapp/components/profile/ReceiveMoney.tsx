'use client'

import { useState } from 'react'
import QRCode from 'qrcode'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'

import { ensureUSDCTrustline } from '@/services/wallet/usdcTrustline'
import { formatAddressForClipboard } from '@/utils/formatting'

/** Prepare USDC before revealing receiving details, including for embedded accounts. */
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
  const [expanded, setExpanded] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const open = async () => {
    if (state === 'preparing') return
    if (expanded) {
      setExpanded(false)
      return
    }
    if (state === 'ready') {
      setExpanded(true)
      return
    }
    setError(null)
    setState('preparing')
    try {
      const created = await ensureUSDCTrustline(walletAddress)
      if (created) onReady?.()
      setQr(await QRCode.toDataURL(walletAddress, { margin: 1, width: 200 }))
      setState('ready')
      setExpanded(true)
    } catch (err) {
      console.error('Could not prepare account to receive USDC', err)
      setError(t('balances.receive_error'))
      setState('idle')
    }
  }

  const copy = async () => {
    setError(null)
    try {
      await navigator.clipboard.writeText(
        formatAddressForClipboard(walletAddress)
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('profile.dashboard.copy_error'))
    }
  }

  return (
    <div>
      <button
        onClick={open}
        disabled={state === 'preparing'}
        aria-expanded={expanded}
        aria-controls="profile-receive-details"
        className="btn-secondary flex min-h-12 w-full items-center justify-center gap-2 text-sm"
      >
        {state === 'preparing' ? (
          <ArrowPathIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : expanded ? (
          <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
        ) : (
          <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
        )}
        {t(
          state === 'preparing'
            ? 'balances.receive_preparing'
            : expanded
              ? 'profile.dashboard.close_receive'
              : 'balances.receive_button'
        )}
      </button>
      <div id="profile-receive-details" hidden={!expanded}>
        {state === 'ready' && (
          <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-[#e0e8e1] bg-[#f7f9f6] p-4 text-center">
            <p className="text-sm font-semibold text-[#214f40]">
              {t('profile.dashboard.receive_title')}
            </p>
            {qr && (
              <img
                src={qr}
                alt={t('profile.dashboard.receive_qr')}
                width={200}
                height={200}
                className="h-44 w-44 rounded-xl border border-[#e5ebe6] bg-white p-2"
              />
            )}
            <p className="w-full break-all rounded-lg bg-white p-3 font-mono text-xs text-gray-700">
              {walletAddress}
            </p>
            <button
              onClick={copy}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#286b56]"
            >
              <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
              {copied ? t('balances.copied') : t('balances.copy_address')}
            </button>
            <p className="text-xs leading-relaxed text-[#5a6760]">
              {t('balances.receive_description')}
            </p>
          </div>
        )}
      </div>
      <p role="status" className="sr-only">
        {copied
          ? t('balances.copied')
          : state === 'preparing'
            ? t('balances.receive_preparing')
            : ''}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
