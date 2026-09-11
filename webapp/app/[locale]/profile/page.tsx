'use client'

import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { useUser } from '@/lib/providers/UserProvider'
import { useProfileForm, useBalances } from '@/hooks'
import {
  ProfileForm,
  BalancesSection,
  FundingSection,
  TrustlineNotice,
  DistributionClaims,
  TestnetFaucet,
} from '@/components/profile'
import { ExportWalletKey } from '@/components/profile/ExportWalletKey'
import { LoginMethodsLinks } from '@/components/profile/LoginMethodsLinks'
import {
  PASSKEY_LOGIN_ENABLED,
  SOCIAL_LOGIN_ENABLED,
} from '@/lib/auth/loginMethods'
import { isPrivyEnabled } from '@/services/wallet/privySigner'

export default function ProfilePage() {
  const t = useTranslations()
  const locale = useLocale()
  const { user, loading, error: userError, refreshUser } = useUser()
  const form = useProfileForm(user, t, refreshUser)
  const balances = useBalances(user, loading, t)
  // The view is a presentation preference, independent of the login provider.
  // Keep it local so every visit starts with the simplified view.
  const [simple, setSimple] = useState(true)
  const isPrivy = user?.walletProvider === 'privy'
  const error = userError || form.error
  const initials = user?.name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  if (loading && !user)
    return (
      <main
        className="app-container py-10"
        aria-busy="true"
        aria-label={t('profile.loading')}
      >
        <p className="sr-only" role="status">
          {t('profile.loading')}
        </p>
        <div className="h-28 rounded-2xl bg-white/70 motion-safe:animate-pulse" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-3xl bg-white/70 motion-safe:animate-pulse" />
          <div className="h-80 rounded-3xl bg-white/70 motion-safe:animate-pulse" />
        </div>
      </main>
    )

  if (!user)
    return (
      <main className="profile-page app-container py-16">
        <div className="surface-card mx-auto max-w-md p-8 text-center">
          <UserIcon className="mx-auto mb-4 h-10 w-10 text-surface-primary-default" />
          <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
          <p
            className="my-4 text-sm text-gray-600"
            role={error ? 'alert' : undefined}
          >
            {error || t('profile.error_not_authenticated')}
          </p>
          <Link href={`/${locale}/login`} className="btn-primary inline-flex">
            {t('profile.dashboard.login')}
          </Link>
        </div>
      </main>
    )

  return (
    <main className="profile-page app-container py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white bg-[#e3ece5] text-xl font-bold text-[#286b56] sm:h-20 sm:w-20 sm:text-2xl"
            aria-hidden="true"
          >
            {initials || <UserIcon className="h-8 w-8" />}
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#66756b]">
              {t('profile.dashboard.eyebrow')}
            </p>
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
              {user.name
                ? t('profile.dashboard.greeting', { name: user.name })
                : t('profile.title')}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#5a6760]">
              {t(
                simple
                  ? 'profile.dashboard.subtitle_simple'
                  : 'profile.dashboard.subtitle_wallet'
              )}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d5e2d9] bg-white/70 px-3 py-2 text-xs font-medium text-[#286b56]">
            <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
            {t(
              isPrivy
                ? 'profile.dashboard.account_simple'
                : 'profile.dashboard.account_wallet'
            )}
          </span>
          <div
            role="group"
            aria-label={t('profile.dashboard.view_label')}
            className="inline-flex w-full rounded-xl border border-[#d5e2d9] bg-white/70 p-1 sm:w-auto"
          >
            {(['simple', 'advanced'] as const).map((view) => {
              const selected = simple === (view === 'simple')
              return (
                <button
                  key={view}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSimple(view === 'simple')}
                  className={`min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                    selected
                      ? 'bg-[#286b56] text-white shadow-sm'
                      : 'text-[#5a6760] hover:bg-[#eaf1ef] hover:text-[#214f40]'
                  }`}
                >
                  {t(`profile.dashboard.view_${view}`)}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {form.success && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          {t('profile.success_message')}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0 space-y-6">
          <BalancesSection
            key={user.walletAddress ?? user.id}
            balances={balances}
            user={user}
            t={t}
            simple={simple}
          />
          <DistributionClaims
            walletAddress={user.walletAddress ?? null}
            onClaimed={balances.fetchBalances}
            t={t}
            simple={simple}
          />
          {!simple && (
            <section
              className="surface-card p-5 sm:p-6"
              aria-labelledby="stellar-tools-title"
            >
              <h2 id="stellar-tools-title" className="text-lg font-bold">
                {t('profile.dashboard.wallet_tools')}
              </h2>
              <p className="mb-5 mt-1 text-sm text-[#5a6760]">
                {t('profile.dashboard.wallet_tools_description')}
              </p>
              <TrustlineNotice
                walletAddress={user.walletAddress ?? null}
                onCreated={balances.fetchBalances}
                t={t}
              />
              <FundingSection user={user} t={t} />
            </section>
          )}
          {process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'testnet' &&
            user.walletAddress && (
              <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-5">
                <h2 className="text-sm font-bold text-amber-900">
                  {t('profile.dashboard.test_title')}
                </h2>
                <p className="mt-1 text-sm text-amber-900/80">
                  {t('profile.dashboard.test_description')}
                </p>
                <TestnetFaucet
                  walletAddress={user.walletAddress}
                  simple={simple}
                  onFunded={balances.fetchBalances}
                  t={t}
                />
              </section>
            )}
        </div>

        <div className="min-w-0 space-y-6">
          <Link
            href={`/${locale}/my-orders`}
            className="group flex items-center gap-4 rounded-2xl border border-[#d5e2d9] bg-[#eaf1e9] p-5 transition hover:bg-[#e1ebdf] sm:p-6"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#286b56]">
              <ShoppingBagIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block font-bold">
                {t('profile.dashboard.orders_title')}
              </span>
              <span className="mt-1 block text-sm text-[#5a6760]">
                {t('profile.dashboard.orders_description')}
              </span>
            </span>
            <ArrowRightIcon
              className="h-5 w-5 shrink-0 text-[#286b56] transition group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
          <ProfileForm form={form} t={t} />
          <section
            className="surface-card p-5 sm:p-6"
            aria-labelledby="account-access-title"
          >
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheckIcon
                className="h-5 w-5 text-[#286b56]"
                aria-hidden="true"
              />
              <h2 id="account-access-title" className="text-lg font-bold">
                {t('profile.dashboard.access_title')}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-[#5a6760]">
              {t(
                isPrivy
                  ? 'profile.dashboard.access_simple'
                  : 'profile.dashboard.access_wallet'
              )}
            </p>
            {isPrivyEnabled() &&
              isPrivy &&
              (SOCIAL_LOGIN_ENABLED || PASSKEY_LOGIN_ENABLED) && (
                <LoginMethodsLinks t={t} />
              )}
            {isPrivyEnabled() && isPrivy && user.walletAddress && (
              <details className="group mt-5 border-t border-[#e5ebe6] pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-sm font-medium text-[#5a6760] [&::-webkit-details-marker]:hidden">
                  {t('balances.advanced_options')}
                  <ChevronDownIcon
                    className="h-4 w-4 transition group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <ExportWalletKey walletAddress={user.walletAddress} t={t} />
              </details>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
