'use client'

import { ArchiveBoxIcon, ScaleIcon, ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { ExplorerLink } from '@/components/trace'
import type { ApiError } from '@/lib/api'
import { batchesService } from '@/services/api/batches'
import type { PilotSummary as Summary } from '@/types/traceability'

import { StageChip } from './StageChip'

/**
 * What is happening in the pilot: farmers, batches and kg, per cooperative,
 * and the latest steps recorded on Stellar. Everything here is pseudonymous
 * and already public on chain, so every signed-in user sees it.
 */
export function PilotSummary({ refreshKey }: { refreshKey: number }) {
  const t = useTranslations('summary')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSummary(await batchesService.summary())
    } catch (err) {
      setError((err as ApiError).message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const number = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)
  const ago = (iso: string) => {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (minutes < 60) return rtf.format(-minutes, 'minute')
    if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), 'hour')
    return rtf.format(-Math.round(minutes / (60 * 24)), 'day')
  }

  if (error) {
    return (
      <section className="surface-card p-5 text-center sm:p-6" role="alert">
        <p className="text-red-800">{error}</p>
        <button type="button" className="btn-secondary mt-4" onClick={load}>
          {tc('retry')}
        </button>
      </section>
    )
  }

  if (!summary) {
    return <div className="h-48 animate-pulse rounded-2xl bg-white/70" aria-busy="true" />
  }

  const pendingWeigh = summary.batches.byStage.DELIVERED ?? 0
  const tiles = [
    { icon: ArchiveBoxIcon, value: number(summary.batches.total), label: t('tile_batches'), hint: t('tile_batches_hint', { count: pendingWeigh }) },
    { icon: ScaleIcon, value: `${number(summary.receivedKg)} kg`, label: t('tile_kg'), hint: t('tile_kg_hint') },
    { icon: UserGroupIcon, value: number(summary.farmers.linked), label: t('tile_farmers'), hint: t('tile_farmers_hint', { total: summary.farmers.total }) },
    { icon: ShieldCheckIcon, value: number(summary.farmers.consented), label: t('tile_consent'), hint: t('tile_consent_hint') },
  ]

  return (
    <section className="space-y-4" aria-labelledby="summary-title">
      <div>
        <h2 id="summary-title" className="text-lg font-bold">
          {t('title')}
        </h2>
        <p className="text-sm text-[#5a6760]">{t('subtitle')}</p>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, value, label, hint }) => (
          <li key={label} className="surface-card p-4 sm:p-5">
            <Icon className="h-6 w-6 text-[rgb(var(--cb-primary))]" aria-hidden="true" />
            <p className="mt-3 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
            <p className="mt-1 font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-[#5a6760]">{hint}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="surface-card overflow-x-auto p-1">
          <table className="data-table !min-w-0">
            <caption className="px-4 pt-4 text-left font-bold">{t('by_coop')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('col_coop')}</th>
                <th scope="col" className="text-right">{t('col_farmers')}</th>
                <th scope="col" className="text-right">{t('col_batches')}</th>
                <th scope="col" className="text-right">{t('col_kg')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.cooperatives.map((coop) => (
                <tr key={coop.id}>
                  <td>
                    <span className="font-semibold">{coop.name}</span>
                  </td>
                  <td className="text-right tabular-nums">
                    {coop.farmersLinked}
                    <span className="text-[#8a968f]"> / {coop.farmers}</span>
                  </td>
                  <td className="text-right tabular-nums">{coop.batches}</td>
                  <td className="text-right tabular-nums">{number(coop.receivedKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="surface-card p-5">
          <h3 className="font-bold">{t('recent_title')}</h3>
          {summary.recent.length === 0 ? (
            <p className="mt-3 text-sm text-[#5a6760]">{t('recent_empty')}</p>
          ) : (
            <ol className="mt-3 divide-y divide-[#e9eee9]">
              {summary.recent.map((event) => (
                <li key={event.txHash} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {event.stage === 'DELIVERED'
                        ? event.batch.estimatedKg != null
                          ? t('event_delivered_kg', { farmer: event.batch.farmerRef, kg: number(event.batch.estimatedKg), center: event.batch.collectionCenter.name })
                          : t('event_delivered', { farmer: event.batch.farmerRef, center: event.batch.collectionCenter.name })
                        : event.stage === 'RECEIVED' && event.batch.weightKg != null
                          ? t('event_received', { kg: number(event.batch.weightKg), center: event.batch.collectionCenter.name })
                          : t('event_stage', { batch: event.batch.number })}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#5a6760]">
                      <StageChip stage={event.stage} />
                      <span className="font-mono">{event.batch.number}</span>
                      <span>· {ago(event.at)}</span>
                    </p>
                  </div>
                  <ExplorerLink kind="tx" id={event.txHash} className="shrink-0 text-sm">
                    {t('view_tx')}
                  </ExplorerLink>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
