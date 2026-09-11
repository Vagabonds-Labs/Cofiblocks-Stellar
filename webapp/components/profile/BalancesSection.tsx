'use client'

import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import type { User } from '@/services/auth/types'
import type { useBalances } from '@/hooks/profile/useBalances'
import { formatAddressForClipboard } from '@/utils/formatting'
import { ReceiveMoney } from './ReceiveMoney'
import { TransferModal } from './TransferModal'

export function BalancesSection({
  balances,
  user,
  t,
  simple = false,
}: {
  balances: ReturnType<typeof useBalances>
  user: User
  t: ReturnType<typeof useTranslations>
  simple?: boolean
}) {
  const locale = useLocale()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [selectedToken, setSelectedToken] = useState<'USDC' | 'XLM' | null>(
    null
  )
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK
  const unavailable = !user.walletAddress || !!balances.balancesError
  const busy = balances.loadingBalances

  const handleCopy = async () => {
    if (!user.walletAddress) return
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(
        formatAddressForClipboard(user.walletAddress)
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
    }
  }

  const transferButton = (
    <button
      onClick={() => setSelectedToken('USDC')}
      disabled={unavailable || busy}
      className="btn-secondary inline-flex items-center justify-center gap-2 text-sm"
    >
      <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
      {t('balances.menu_transfer')}
    </button>
  )

  return (
    <section
      className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_12px_40px_rgba(22,40,30,0.08)]"
      aria-labelledby="profile-balance-title"
    >
      <div className="relative overflow-hidden bg-[#214f40] p-6 text-white sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border-[40px] border-white/[0.035]"
        />
        <div className="relative flex items-center justify-between gap-3">
          <h2
            id="profile-balance-title"
            className="flex items-center gap-2 text-sm font-medium text-[#dbe9de]"
          >
            <WalletIcon className="h-5 w-5" aria-hidden="true" />
            {t('balances.your_balance')}
          </h2>
          <button
            onClick={balances.fetchBalances}
            disabled={busy || !user.walletAddress}
            aria-label={t('balances.refresh')}
            title={t('balances.refresh')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
        <div className="relative mt-5" aria-live="polite" aria-busy={busy}>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="break-all text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
              {busy || unavailable
                ? '—'
                : `${simple ? '$' : ''}${balances.balances.usdc}`}
            </span>
            <span className="text-sm font-medium text-[#dbe9de]">
              {simple ? 'USD' : 'USDC'}
            </span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#dbe9de]">
            {busy
              ? t('balances.loading')
              : t('profile.dashboard.balance_description')}
          </p>
        </div>
        <Link
          href={`/${locale}`}
          className="relative mt-7 inline-flex min-h-11 items-center justify-center gap-3 rounded-xl bg-[#f0e9d9] px-5 py-3 text-sm font-bold text-[#214f40] transition hover:bg-white"
        >
          {t('profile.dashboard.explore')}
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
        {network === 'testnet' && (
          <p className="relative mt-5 text-xs text-[#dbe9de]">
            {t('profile.dashboard.test_balance')}
          </p>
        )}
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {balances.balancesError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {t('balances.error_loading')}
          </p>
        )}
        {!user.walletAddress ? (
          <p className="text-sm text-[#5a6760]">
            {t('balances.no_wallet_address')}
          </p>
        ) : (
          <ReceiveMoney
            walletAddress={user.walletAddress}
            onReady={balances.fetchBalances}
            t={t}
          />
        )}

        {!simple && (
          <div className="space-y-5 border-t border-[#e5ebe6] pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#edf1ee] text-sm font-bold text-[#286b56]">
                  X
                </span>
                <div>
                  <h3 className="text-sm font-semibold">XLM</h3>
                  <p className="text-xs text-[#68776d]">Stellar Lumens</p>
                </div>
              </div>
              <div className="text-right">
                <p className="break-all text-sm font-semibold tabular-nums">
                  {busy || unavailable ? '—' : balances.balances.xlm}
                </p>
                <button
                  onClick={() => setSelectedToken('XLM')}
                  disabled={busy || unavailable}
                  className="min-h-9 rounded px-1 text-xs font-semibold text-[#286b56] hover:underline disabled:opacity-50"
                >
                  {t('profile.dashboard.send')}
                </button>
              </div>
            </div>
            {transferButton}
            <div className="rounded-xl border border-[#e5ebe6] bg-[#f7f9f6] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#5a6760]">
                  {t('balances.wallet_address_label')}
                </h3>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-[#286b56]">
                  Stellar
                  {network === 'testnet'
                    ? ' · Testnet'
                    : network === 'public' || network === 'mainnet'
                      ? ' · Mainnet'
                      : ''}
                </span>
              </div>
              {user.walletAddress && (
                <button
                  onClick={handleCopy}
                  title={user.walletAddress}
                  aria-label={t('balances.copy_address')}
                  className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left font-mono text-xs text-[#354a3f] hover:text-[#286b56]"
                >
                  <span className="break-all">{user.walletAddress}</span>
                  <ClipboardDocumentIcon
                    className="h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              )}
              <p role="status" className="mt-2 text-xs text-[#5a6760]">
                {copyError
                  ? t('profile.dashboard.copy_error')
                  : copied
                    ? t('balances.copied')
                    : t('balances.click_to_copy')}
              </p>
            </div>
          </div>
        )}
        {simple && user.walletAddress && (
          <details className="group border-t border-[#e5ebe6] pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-sm font-medium text-[#5a6760] [&::-webkit-details-marker]:hidden">
              {t('profile.dashboard.transfer_options')}
              <ChevronDownIcon
                className="h-4 w-4 transition group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="my-3 text-sm leading-relaxed text-[#5a6760]">
              {t('profile.dashboard.transfer_description')}
            </p>
            {transferButton}
          </details>
        )}
      </div>
      {selectedToken && (
        <TransferModal
          isOpen
          onClose={() => setSelectedToken(null)}
          tokenLabel={selectedToken}
          tokenBalance={
            selectedToken === 'XLM'
              ? balances.balances.xlm
              : balances.balances.usdc
          }
          userWalletAddress={user.walletAddress ?? ''}
          onTransferred={balances.fetchBalances}
          t={t}
        />
      )}
    </section>
  )
}
