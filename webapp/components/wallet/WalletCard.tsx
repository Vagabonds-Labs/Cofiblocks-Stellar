'use client'

import {
  ArrowPathIcon,
  CheckIcon,
  DocumentDuplicateIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { ExplorerLink } from '@/components/trace'
import { useWallet } from '@/hooks/wallet/useWallet'

/** The profile's balance overview. Account setup remains managed by useWallet. */
export function WalletCard({
  address,
  className = '',
}: {
  address: string
  className?: string
}) {
  const t = useTranslations('wallet')
  const locale = useLocale()
  const { wallet, state, retry } = useWallet()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle'
  )
  const busy = state === 'loading' || state === 'setting_up'
  const isTestnet = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'mainnet'
  // A balance must belong to the address shown, including during account changes.
  const currentWallet = wallet?.address === address ? wallet : null
  const balance =
    currentWallet?.balance_xlm != null
      ? Number(currentWallet.balance_xlm)
      : null
  const hasBalance = balance !== null && Number.isFinite(balance)
  const parts = hasBalance
    ? new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 7,
      }).formatToParts(balance!)
    : []
  const integer = parts
    .filter((part) => part.type === 'integer' || part.type === 'group')
    .map((part) => part.value)
    .join('')
  const decimals = parts
    .filter((part) => part.type === 'decimal' || part.type === 'fraction')
    .map((part) => part.value)
    .join('')

  useEffect(() => {
    if (copyState === 'idle') return
    const timer = setTimeout(() => setCopyState('idle'), 2500)
    return () => clearTimeout(timer)
  }, [copyState])

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <section
      className={`relative isolate overflow-hidden rounded-[28px] bg-[#244c3b] text-white shadow-[0_16px_48px_-24px_rgba(26,64,42,0.6)] ${className}`}
      aria-labelledby="wallet-balance-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(180,208,139,0.22),transparent_65%)]"
        aria-hidden="true"
      />
      <svg
        viewBox="0 0 200 200"
        fill="none"
        className="pointer-events-none absolute -right-10 -top-8 h-64 w-64 text-[#cfdfb7]/10 sm:right-2 sm:top-0"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="100"
          cy="100"
          r="72"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx="100"
          cy="100"
          r="56"
          stroke="currentColor"
          strokeWidth="15"
        />
        <path
          d="m31 142 138-83M31 157l138-83"
          stroke="#244c3b"
          strokeWidth="10"
        />
        <path
          d="m22 151 156-93m-156 108 156-93"
          stroke="currentColor"
          strokeWidth="3"
        />
      </svg>

      <div className="relative flex h-full flex-col p-5 sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[#e0ebd8]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <WalletIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="wallet-balance-title" className="text-sm font-medium">
              {t('current_balance')}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#e0ebd8]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#c5d89f]"
              aria-hidden="true"
            />
            {isTestnet ? 'Stellar Testnet' : 'Stellar Mainnet'}
          </span>
        </div>

        <div
          className="mb-6 mt-7 min-h-[105px]"
          aria-live="polite"
          aria-busy={busy}
        >
          {hasBalance ? (
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
              <span className="min-w-0 break-all text-4xl font-semibold tracking-[-0.05em] sm:text-5xl xl:text-6xl">
                {integer}
                <span className="text-xl font-normal tracking-[-0.02em] text-[#d0dfc4] sm:text-2xl xl:text-3xl">
                  {decimals}
                </span>
              </span>
              <span className="text-sm font-medium tracking-wide text-[#d0dfc4] sm:text-base">
                XLM
              </span>
            </p>
          ) : busy ? (
            <div
              className="h-14 w-56 max-w-full rounded-xl bg-white/10 motion-safe:animate-pulse"
              aria-hidden="true"
            />
          ) : (
            <p
              className="text-5xl font-light text-[#d0dfc4]"
              aria-label={t('balance_unavailable')}
            >
              —
            </p>
          )}

          <p className="mt-3 text-xs text-[#c6d8be]">
            {t(isTestnet ? 'testnet_hint' : 'mainnet_hint')}
          </p>
          {busy && (
            <p className="mt-3 flex items-center gap-2 text-xs text-[#e0ebd8]">
              <ArrowPathIcon
                className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin"
                aria-hidden="true"
              />
              {t(state === 'setting_up' ? 'setting_up' : 'loading')}
            </p>
          )}
          {state === 'error' && (
            <p
              role="alert"
              className="mt-3 text-xs leading-relaxed text-[#ffe3ba]"
            >
              {t(hasBalance ? 'refresh_error' : 'setup_error')}
            </p>
          )}
          {state === 'ready' && !hasBalance && (
            <p role="status" className="mt-3 text-xs text-[#ffe3ba]">
              {t('balance_unavailable')}
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-white/15 pt-4">
          <button
            type="button"
            onClick={() => {
              void retry()
            }}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-wait disabled:opacity-50"
          >
            <ArrowPathIcon
              className={`h-3.5 w-3.5 ${busy ? 'motion-safe:animate-spin' : ''}`}
              aria-hidden="true"
            />
            {t(state === 'error' ? 'retry' : 'refresh_balance')}
          </button>
          <ExplorerLink
            kind="account"
            id={address}
            className="!text-xs !text-[#e0ebd8]"
          >
            {t('view_account')}
          </ExplorerLink>
          {currentWallet?.fund_tx && (
            <ExplorerLink
              kind="tx"
              id={currentWallet.fund_tx}
              className="!text-xs !text-[#e0ebd8]"
            >
              {t('view_funding')}
            </ExplorerLink>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-medium text-[#c6d8be]">
              {t('address')}
            </p>
            <p className="break-all font-mono text-[10px] leading-relaxed text-[#e0ebd8]">
              {address}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void copyAddress()
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#e0ebd8] transition-colors hover:bg-white/10"
            aria-label={t(
              copyState === 'copied' ? 'address_copied' : 'copy_address'
            )}
            title={t(
              copyState === 'copied' ? 'address_copied' : 'copy_address'
            )}
          >
            {copyState === 'copied' ? (
              <CheckIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <DocumentDuplicateIcon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="sr-only" role="status">
          {copyState === 'copied'
            ? t('address_copied')
            : copyState === 'error'
              ? t('copy_error')
              : ''}
        </p>
        {copyState === 'error' && (
          <p className="mt-2 text-xs text-[#ffe3ba]">{t('copy_error')}</p>
        )}
      </div>
    </section>
  )
}
