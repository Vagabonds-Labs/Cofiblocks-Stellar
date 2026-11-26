'use client'

import {
  ArrowRightIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCallback, useState } from 'react'

import {
  BatchesSection,
  MyBatches,
  PendingDeliveries,
  RecordedDeliveries,
  PilotSummary,
} from '@/components/batches'

import { useUser } from '@/lib/providers/UserProvider'
import type { User } from '@/services/auth/types'

export default function HomePage() {
  const { user, loading } = useUser()

  if (loading && !user) {
    return (
      <main className="app-page app-container py-16" aria-busy="true">
        <div className="h-40 animate-pulse rounded-3xl bg-white/70" />
      </main>
    )
  }

  return user ? <StaffHome key={user.id} user={user} /> : <Landing />
}

function Landing() {
  const t = useTranslations('home')
  const locale = useLocale()

  const steps = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: t('step_farmers_title'),
      text: t('step_farmers_text'),
    },
    {
      icon: BuildingStorefrontIcon,
      title: t('step_coop_title'),
      text: t('step_coop_text'),
    },
    {
      icon: GlobeAltIcon,
      title: t('step_union_title'),
      text: t('step_union_text'),
    },
  ]

  return (
    <main className="app-page pb-16">
      <section className="app-container grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[#8a6a2f]">
            {t('eyebrow')}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-[#1d2b24] sm:text-5xl">
            {t('hero_title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4c5a52]">
            {t('hero_subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/${locale}/login`}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3"
            >
              {t('hero_cta')}
              <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2 text-sm">
            {[t('pilot_coops'), t('pilot_farmers'), t('pilot_centers')].map(
              (item) => (
                <li
                  key={item}
                  className="chip chip-neutral px-3 py-1.5 text-sm"
                >
                  {item}
                </li>
              )
            )}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <img
            src="/images/coffee-ritual.webp"
            alt=""
            className="aspect-[4/3] w-full object-cover"
            width={1200}
            height={800}
          />
          <div className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-2xl bg-white/90 p-4 backdrop-blur sm:inset-x-6 sm:bottom-6">
            <ShieldCheckIcon
              className="h-6 w-6 shrink-0 text-[rgb(var(--cb-primary))]"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">{t('verified_title')}</p>
              <p className="mt-1 text-sm text-[#4c5a52]">
                {t('verified_text')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="app-container" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-bold">
          {t('how_title')}
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="surface-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf1ef] text-[rgb(var(--cb-primary))]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-[#8a6a2f]">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4c5a52]">
                {text}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

function StaffHome({ user }: { user: User }) {
  const t = useTranslations()
  const locale = useLocale()
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  const ownCoopId =
    !user.isAdmin && user.role && user.role !== 'EXPORT_MANAGER'
      ? (user.organizationId ?? null)
      : null
  const [selectedCoopId, setSelectedCoopId] = useState(ownCoopId ?? '')

  const exploreCooperative = (id: string) => {
    setSelectedCoopId(id)
    const heading = document.getElementById('batches-title')
    heading?.scrollIntoView({ block: 'start' })
    heading?.focus({ preventScroll: true })
  }

  const processRole =
    user.role === 'INDUSTRY_MANAGER' ||
    user.role === 'STORE_KEEPER' ||
    user.role === 'EXPORT_MANAGER'
  const place = [user.organization?.name, user.collectionCenter?.name]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="app-page app-container space-y-10 py-8 sm:py-10">
      {/* What this person has to do comes first, apart from the overview. */}
      <section
        aria-labelledby="tasks-title"
        className="rounded-3xl border border-[#cddbc9] bg-[#eef4ec] p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#526749]">
              {user.name
                ? t('home.greeting', { name: user.name })
                : t('home.greeting_anonymous')}
            </p>
            <h2
              id="tasks-title"
              className="mt-1 text-2xl font-bold tracking-tight text-[#2d432e]"
            >
              {t('home.tasks_title')}
            </h2>
            {user.role ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#4c5a52]">
                <span className="chip bg-white text-[#2d432e]">
                  {t(`roles.${user.role}`)}
                </span>
                {place && <span>{place}</span>}
              </p>
            ) : null}
            <p className="mt-2 max-w-2xl text-sm text-[#4c5a52]">
              {user.role
                ? t(`home.tasks_${user.role}`)
                : user.isAdmin
                  ? t('home.tasks_admin')
                  : t('home.no_role_text')}
            </p>
          </div>
          {user.isAdmin && (
            <nav
              aria-label={t('home.admin_title')}
              className="flex flex-wrap gap-2"
            >
              <AdminLink
                href={`/${locale}/admin/farmers`}
                icon={UserGroupIcon}
                title={t('user_menu.manage_farmers')}
              />
              <AdminLink
                href={`/${locale}/admin/users`}
                icon={ShieldCheckIcon}
                title={t('user_menu.manage_users')}
              />
            </nav>
          )}
        </div>

        {(user.role === 'COLLECTOR' || processRole) && (
          <div className="mt-5 space-y-5">
            {user.role === 'COLLECTOR' && (
              <>
                <PendingDeliveries
                  collectionCenterId={user.collectionCenterId ?? null}
                  refreshKey={refreshKey}
                  onRecorded={refresh}
                />
                <RecordedDeliveries
                  organizationId={user.organizationId ?? null}
                  collectionCenterId={user.collectionCenterId ?? null}
                  refreshKey={refreshKey}
                  onConfirmed={refresh}
                />
              </>
            )}
            {processRole && <MyBatches refreshKey={refreshKey} />}
          </div>
        )}
      </section>

      <div className="space-y-8 border-t border-[#dfe6e0] pt-10">
        <header className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#71815d]">
            {t('home.overview_title')}
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[#2d432e] sm:text-4xl">
            {t('dashboard.title')}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#68756a]">
            {t('dashboard.subtitle')}
          </p>
        </header>

        <PilotSummary
          refreshKey={refreshKey}
          ownCoopId={ownCoopId}
          selectedCoopId={selectedCoopId}
          onSelectCooperative={exploreCooperative}
        />

        <BatchesSection
          refreshKey={refreshKey}
          cooperativeId={selectedCoopId}
          onCooperativeChange={setSelectedCoopId}
        />
      </div>
    </main>
  )
}

function AdminLink({
  href,
  icon: Icon,
  title,
}: {
  href: string
  icon: typeof ShieldCheckIcon
  title: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-[#d8e0ce] bg-white/70 px-4 py-2.5 text-xs font-semibold text-[#526749] transition hover:bg-white"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {title}
    </Link>
  )
}
