'use client'

import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  MapPinIcon,
  EnvelopeIcon,
  InformationCircleIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  UserIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

import { useUser } from '@/lib/providers/UserProvider'
import { useProfileForm } from '@/hooks'
import { ProfileForm } from '@/components/profile'
import { WalletCard } from '@/components/wallet'

const WALLET_NAMES: Record<string, string> = {
  freighter: 'Freighter',
  lobstr: 'LOBSTR',
  xbull: 'xBull',
  albedo: 'Albedo',
  rabet: 'Rabet',
}

/**
 * How this account signs in. Each method (an email, Telegram, a wallet) has
 * its own Stellar wallet, so this is the answer to "why did my wallet change?".
 */
function LoginMethodRow({
  user,
}: {
  user: NonNullable<ReturnType<typeof useUser>['user']>
}) {
  const t = useTranslations('profile.login')
  const locale = useLocale()
  const method =
    user.loginMethod ?? (user.walletProvider === 'cavos' ? null : 'wallet')
  const Icon =
    method === 'email'
      ? EnvelopeIcon
      : method === 'telegram'
        ? PaperAirplaneIcon
        : WalletIcon
  const walletName = user.walletApp
    ? (WALLET_NAMES[user.walletApp] ?? user.walletApp)
    : null

  const title =
    method === 'email'
      ? t('email')
      : method === 'telegram'
        ? t('telegram')
        : method === 'wallet'
          ? walletName
            ? t('wallet_named', { wallet: walletName })
            : t('wallet')
          : t('cavos_unknown')
  const detail = method === 'wallet' ? null : user.loginIdentity

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#e3e8dd] bg-[#f5f7ef] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf1ef] text-[rgb(var(--cb-primary))]">
        <Icon
          className={`h-5 w-5 ${method === 'telegram' ? '-rotate-45' : ''}`}
          aria-hidden="true"
        />
      </span>
      <div className="min-w-0 text-sm">
        <p className="text-[#5a6760]">{t('label')}</p>
        <p className="font-semibold">{title}</p>
        {detail && <p className="break-all text-[#4c5a52]">{detail}</p>}
        {user.lastLoginAt && (
          <p className="mt-1 text-xs text-[#5a6760]">
            {t('last_login', {
              date: new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(user.lastLoginAt)),
            })}
          </p>
        )}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const t = useTranslations()
  const locale = useLocale()
  const { user, loading, error: userError, refreshUser } = useUser()
  const form = useProfileForm(user, t, refreshUser)
  const isCavos = user?.walletProvider === 'cavos'
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
        className="app-page app-container py-10"
        aria-busy="true"
        aria-label={t('profile.loading')}
      >
        <div className="h-28 rounded-2xl bg-white/70 motion-safe:animate-pulse" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-3xl bg-white/70 motion-safe:animate-pulse" />
          <div className="h-64 rounded-3xl bg-white/70 motion-safe:animate-pulse" />
        </div>
      </main>
    )

  if (!user)
    return (
      <main className="app-page app-container py-16">
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
    <main className="app-page app-container py-7 sm:py-10">
      <header className="mb-7 sm:mb-8">
        <Link
          href={`/${locale}`}
          className="mb-5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-[#68785f] transition-colors hover:text-[#244c3b]"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t('profile.overview.back')}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#71815d]">
              {t('profile.dashboard.eyebrow')}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2d432e] sm:text-4xl">
              {t('profile.title')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#68756a]">
              {t('profile.overview.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {form.success && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-[#cddfc5] bg-[#edf5e9] p-4 text-sm text-[#345c32]"
        >
          <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {t('profile.success_message')}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <div
        className={`grid gap-5 ${user.walletAddress ? 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]' : ''}`}
      >
        {user.walletAddress && (
          <WalletCard key={user.walletAddress} address={user.walletAddress} />
        )}

        <section
          className="flex min-w-0 flex-col rounded-[28px] border border-[#e0e5d9] bg-[#fffefb] p-5 sm:p-7"
          aria-labelledby="profile-identity-title"
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-[#dce5d0] bg-[#ecf1e2] text-xl font-bold text-[#526c42]"
              aria-hidden="true"
            >
              {initials || <UserIcon className="h-7 w-7" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7a856f]">
                {t('profile.overview.identity')}
              </p>
              <h2
                id="profile-identity-title"
                className="mt-1 break-words text-xl font-bold tracking-tight text-[#2d432e]"
              >
                {user.name || t('profile.overview.unnamed')}
              </h2>
            </div>
          </div>

          <dl className="mt-6 space-y-5 border-t border-[#e9ecdf] pt-5">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon
                className="mt-0.5 h-4 w-4 shrink-0 text-[#829373]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-[#78816f]">
                  {t('home.role_label')}
                </dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {/* Admin is an app permission: preserve both when there is also a pilot role. */}
                  {user.role && (
                    <span className="rounded-lg bg-[#edf2e5] px-2.5 py-1 text-xs font-semibold text-[#526c42]">
                      {t(`roles.${user.role}`)}
                    </span>
                  )}
                  {user.isAdmin && (
                    <span className="rounded-lg bg-[#f5eddd] px-2.5 py-1 text-xs font-semibold text-[#85612f]">
                      {t('roles.admin')}
                    </span>
                  )}
                  {!user.role && !user.isAdmin && (
                    <span className="text-sm text-[#4e5d48]">
                      {t('roles.none')}
                    </span>
                  )}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BuildingOffice2Icon
                className="mt-0.5 h-4 w-4 shrink-0 text-[#829373]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <dt className="text-xs text-[#78816f]">
                  {t('home.organization_label')}
                </dt>
                <dd className="mt-1 break-words text-sm font-medium text-[#4e5d48]">
                  {user.organization?.name || t('profile.overview.unassigned')}
                </dd>
              </div>
            </div>
            {user.collectionCenter && (
              <div className="flex items-start gap-3">
                <MapPinIcon
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#829373]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <dt className="text-xs text-[#78816f]">
                    {t('home.center_label')}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-[#4e5d48]">
                    {user.collectionCenter.name}
                  </dd>
                </div>
              </div>
            )}
          </dl>
          {user.createdAt &&
            Number.isFinite(new Date(user.createdAt).getTime()) && (
              <p className="mt-auto pt-6 text-[11px] text-[#7a856f]">
                {t('profile.overview.member_since', {
                  date: new Intl.DateTimeFormat(locale, {
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(user.createdAt)),
                })}
              </p>
            )}
        </section>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ProfileForm form={form} t={t} />
        <section
          className="min-w-0 rounded-[28px] border border-[#e0e5d9] bg-[#fffefb] p-5 sm:p-7"
          aria-labelledby="account-access-title"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf2e5] text-[#687e53]">
              <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="account-access-title"
              className="text-base font-bold tracking-tight text-[#2d432e]"
            >
              {t('profile.dashboard.access_title')}
            </h2>
          </div>
          <LoginMethodRow user={user} />
          <p className="mt-4 text-xs leading-relaxed text-[#68756a]">
            {t(
              isCavos
                ? 'profile.dashboard.access_simple'
                : 'profile.dashboard.access_wallet'
            )}
          </p>
          <div className="mt-4 flex gap-2.5 border-t border-[#e9ecdf] pt-4 text-xs leading-relaxed text-[#68756a]">
            <InformationCircleIcon
              className="mt-0.5 h-4 w-4 shrink-0 text-[#879875]"
              aria-hidden="true"
            />
            <p>{t('profile.login.one_wallet_per_method')}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
