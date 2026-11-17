'use client'

import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  CheckIcon,
  FlagIcon,
  ScaleIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ExplorerLink } from '@/components/trace'
import { batchesService } from '@/services/api/batches'
import type { BatchStage, PilotSummary as Summary } from '@/types/traceability'

import { CooperativeLandscape } from './CooperativeLandscape'
import { StageChip } from './StageChip'

const JOURNEY: {
  key: 'waiting' | 'processing' | 'export' | 'sold'
  stages: BatchStage[]
}[] = [
  { key: 'waiting', stages: ['DELIVERED'] },
  {
    key: 'processing',
    stages: ['RECEIVED', 'WASHING', 'FERMENTATION', 'DRYING'],
  },
  {
    key: 'export',
    stages: [
      'STORAGE',
      'IN_TRANSPORT_TO_UNION',
      'PREPARED_WITH_EXPORTABLE_BAG',
    ],
  },
  { key: 'sold', stages: ['SOLD'] },
]

export function PilotSummary({
  refreshKey,
  ownCoopId,
  selectedCoopId,
  onSelectCooperative,
}: {
  refreshKey: number
  ownCoopId: string | null
  selectedCoopId: string
  onSelectCooperative: (id: string) => void
}) {
  const t = useTranslations('dashboard')
  const ts = useTranslations('summary')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const requestId = useRef(0)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    const id = ++requestId.current
    inFlight.current = true
    setRefreshing(true)
    try {
      const data = await batchesService.summary()
      if (id !== requestId.current) return
      setSummary(data)
      setUpdatedAt(new Date())
      setError(false)
    } catch {
      if (id === requestId.current) setError(true)
    } finally {
      if (id === requestId.current) {
        inFlight.current = false
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      requestId.current++
      inFlight.current = false
    }
  }, [load, refreshKey])

  const number = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)
  const ago = (iso: string) => {
    const minutes = Math.max(
      0,
      Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    )
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (minutes < 60) return rtf.format(-minutes, 'minute')
    if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), 'hour')
    return rtf.format(-Math.round(minutes / 1440), 'day')
  }

  const eventText = (event: Summary['recent'][number]) =>
    event.stage === 'DELIVERED'
      ? event.batch.estimatedKg != null
        ? ts('event_delivered_kg', {
            farmer: event.batch.farmerRef,
            kg: number(event.batch.estimatedKg),
            center: event.batch.collectionCenter.name,
          })
        : ts('event_delivered', {
            farmer: event.batch.farmerRef,
            center: event.batch.collectionCenter.name,
          })
      : event.stage === 'RECEIVED' && event.batch.weightKg != null
        ? ts('event_received', {
            kg: number(event.batch.weightKg),
            center: event.batch.collectionCenter.name,
          })
        : ts('event_stage', { batch: event.batch.number })

  return (
    <section aria-labelledby="cooperatives-title" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="cooperatives-title"
            className="text-xl font-bold tracking-tight"
          >
            {t('cooperatives')}
          </h2>
          <p className="mt-1 text-sm text-[#68756a]">
            {t('cooperatives_hint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {updatedAt && (
            <p className="text-xs text-[#68756a]" role="status">
              {t('updated', {
                time: new Intl.DateTimeFormat(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(updatedAt),
              })}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              void load()
            }}
            disabled={refreshing}
            className="btn-secondary inline-flex items-center gap-2 !rounded-full !px-3 !py-2 text-xs"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`}
              aria-hidden="true"
            />
            {t('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e3c8b3] bg-[#fff7ed] px-5 py-4 text-sm text-[#7a4425]"
        >
          <p>{summary ? t('refresh_error') : t('load_error')}</p>
          <button
            type="button"
            className="font-bold underline underline-offset-4"
            onClick={() => {
              void load()
            }}
            disabled={refreshing}
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {!summary && !error && (
        <div
          className="grid gap-5 lg:grid-cols-3"
          aria-busy="true"
          aria-label={tc('loading')}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[580px] rounded-[28px] bg-white/70 motion-safe:animate-pulse"
            />
          ))}
        </div>
      )}

      {summary && (
        <>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-[#dde3d8] bg-[#f8f9f3] px-5 py-5 sm:grid-cols-4 sm:px-7">
            {[
              {
                icon: UserGroupIcon,
                value: number(summary.farmers.linked),
                label: ts('tile_farmers'),
              },
              {
                icon: ArchiveBoxIcon,
                value: number(summary.batches.total),
                label: ts('tile_batches'),
              },
              {
                icon: ScaleIcon,
                value: number(summary.receivedKg),
                label: ts('tile_kg'),
              },
              {
                icon: FlagIcon,
                value: number(summary.batches.byStage.DELIVERED ?? 0),
                label: t('waiting'),
              },
            ].map(({ icon: Icon, value, label }) => (
              <li key={label} className="flex min-w-0 items-center gap-3">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf0e3] text-[#527449] sm:flex">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-2xl font-bold tabular-nums tracking-tight">
                    {value}
                  </p>
                  <p className="mt-0.5 text-xs text-[#68756a]">{label}</p>
                </div>
              </li>
            ))}
          </ul>

          {summary.cooperatives.length === 0 ? (
            <p className="surface-card p-8 text-center text-sm text-[#68756a]">
              {t('no_cooperatives')}
            </p>
          ) : (
            <div className="grid items-stretch gap-5 lg:grid-cols-3">
              {summary.cooperatives.map((coop, index) => {
                const selected = selectedCoopId === coop.id
                const linkedPercent =
                  coop.farmers > 0
                    ? Math.min(
                        100,
                        Math.round((coop.farmersLinked / coop.farmers) * 100)
                      )
                    : 0
                const recent = summary.recent.find(
                  (event) => event.batch.organization.id === coop.id
                )
                const stages = coop.byStage ?? {}
                const milestones = [
                  { key: 'milestone_delivery', reached: coop.batches > 0 },
                  { key: 'milestone_weight', reached: coop.receivedKg > 0 },
                  { key: 'milestone_sale', reached: (stages.SOLD ?? 0) > 0 },
                ] as const
                return (
                  <article
                    key={coop.id}
                    className={`group flex min-w-0 flex-col overflow-hidden rounded-[28px] border bg-[#fffefb] shadow-[0_8px_30px_-18px_rgba(37,62,38,0.24)] transition-shadow motion-reduce:transition-none ${selected ? 'border-[#668259] ring-2 ring-[#668259]/20' : 'border-[#dde3d8] hover:shadow-[0_12px_35px_-16px_rgba(37,62,38,0.3)]'}`}
                    aria-labelledby={`coop-${coop.id}`}
                  >
                    <div className="relative overflow-hidden border-b border-[#e6eadf]">
                      <CooperativeLandscape code={coop.code} />
                      <span className="absolute left-5 top-4 rounded-full border border-white/60 bg-white/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#3d5a43]">
                        {t('cooperative_number', {
                          number: String(index + 1).padStart(2, '0'),
                        })}
                      </span>
                      {ownCoopId === coop.id && (
                        <span className="absolute right-4 top-4 rounded-full bg-[#304e36] px-2.5 py-1 text-[10px] font-semibold text-white">
                          {t('your_cooperative')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5 xl:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3
                            id={`coop-${coop.id}`}
                            className="text-xl font-bold tracking-tight text-[#263d2a]"
                          >
                            {coop.name}
                          </h3>
                          <p className="mt-1 text-xs text-[#68756a]">
                            {t('centers', {
                              count: coop.collectionCenters ?? 0,
                            })}
                          </p>
                        </div>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e3e7dc] bg-[#f5f7ee] text-xs font-bold text-[#58734e]">
                          {coop.code}
                        </span>
                      </div>

                      <dl className="my-5 grid grid-cols-2 gap-3 border-y border-[#e9ecdf] py-4">
                        <div>
                          <dt className="text-xs text-[#68756a]">
                            {ts('tile_batches')}
                          </dt>
                          <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
                            {number(coop.batches)}
                          </dd>
                        </div>
                        <div className="border-l border-[#e9ecdf] pl-4">
                          <dt className="text-xs text-[#68756a]">
                            {ts('tile_kg')}
                          </dt>
                          <dd className="mt-1 break-words text-3xl font-bold tabular-nums tracking-tight">
                            {number(coop.receivedKg)}
                          </dd>
                        </div>
                      </dl>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                          <p className="font-semibold text-[#4f644c]">
                            {ts('tile_farmers')}
                          </p>
                          <p className="tabular-nums text-[#68756a]">
                            {t('linked_of', {
                              linked: number(coop.farmersLinked),
                              total: number(coop.farmers),
                            })}
                          </p>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${coop.name}: ${ts('tile_farmers')}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={linkedPercent}
                          aria-valuetext={t('linked_of', {
                            linked: number(coop.farmersLinked),
                            total: number(coop.farmers),
                          })}
                          className="h-2 overflow-hidden rounded-full bg-[#edf0e5]"
                        >
                          <div
                            className="h-full rounded-full bg-[#708953] transition-[width] duration-500 motion-reduce:transition-none"
                            style={{ width: `${linkedPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-5">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#78816e]">
                          {t('journey')}
                        </h4>
                        <ol className="mt-3 grid grid-cols-4 gap-1.5">
                          {JOURNEY.map(({ key, stages: groupStages }) => {
                            const count = groupStages.reduce(
                              (sum, stage) => sum + (stages[stage] ?? 0),
                              0
                            )
                            return (
                              <li
                                key={key}
                                className={`rounded-xl px-1 py-2.5 text-center ${count ? 'bg-[#edf2e5] text-[#3b603c]' : 'bg-[#f6f6f0] text-[#707b68]'}`}
                              >
                                <div
                                  className={`mx-auto mb-2 h-1 w-5 rounded-full ${count ? 'bg-[#8ba775]' : 'bg-[#d9dfcf]'}`}
                                  aria-hidden="true"
                                />
                                <p className="text-lg font-bold tabular-nums">
                                  {number(count)}
                                </p>
                                <p className="mt-1 break-words text-[10px] leading-snug">
                                  {t(key)}
                                </p>
                              </li>
                            )
                          })}
                        </ol>
                      </div>

                      <div className="mt-5" aria-label={t('milestones')}>
                        <ul className="flex flex-wrap gap-x-3 gap-y-2">
                          {milestones.map(({ key, reached }) => (
                            <li
                              key={key}
                              className={`flex items-center gap-1 text-[10px] ${reached ? 'font-semibold text-[#4d7240]' : 'text-[#727b6a]'}`}
                            >
                              {reached ? (
                                <CheckIcon
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <span
                                  className="inline-block h-3 w-3 rounded-full border border-[#bdc7b3]"
                                  aria-hidden="true"
                                />
                              )}
                              {t(key)}
                              <span className="sr-only">
                                : {t(reached ? 'achieved' : 'not_yet')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mb-5 mt-5 flex-1 rounded-xl bg-[#f7f7f1] px-3 py-3">
                        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#75816c]">
                          <SparklesIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {t('latest_step')}
                        </p>
                        {recent ? (
                          <>
                            <p className="text-xs leading-relaxed text-[#4f5e48]">
                              {eventText(recent)}
                            </p>
                            <time
                              dateTime={recent.at}
                              className="mt-1 block text-[10px] text-[#707c68]"
                            >
                              {ago(recent.at)}
                            </time>
                          </>
                        ) : (
                          <p className="text-xs leading-relaxed text-[#707c68]">
                            {coop.batches === 0
                              ? t('first_delivery_hint')
                              : t('no_recent_activity')}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectCooperative(coop.id)}
                        aria-pressed={selected}
                        aria-controls="batches-title"
                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors motion-reduce:transition-none ${selected ? 'border-[#355b3a] bg-[#355b3a] text-white' : 'border-[#d8e0ce] bg-[#f1f5e8] text-[#46643c] hover:border-[#91a67e] hover:bg-[#e7efdc]'}`}
                      >
                        {t(selected ? 'view_selected' : 'explore')}
                        <ArrowRightIcon
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          <section
            className="rounded-[24px] border border-[#dde3d8] bg-white/75 p-5 sm:p-6"
            aria-labelledby="recent-title"
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="recent-title" className="font-bold">
                {t('activity')}
              </h3>
              <p className="text-xs text-[#68756a]">{t('activity_hint')}</p>
            </div>
            {summary.recent.length === 0 ? (
              <p className="py-3 text-sm text-[#68756a]">
                {ts('recent_empty')}
              </p>
            ) : (
              <ol className="divide-y divide-[#edf0e6]">
                {summary.recent.slice(0, 5).map((event) => (
                  <li
                    key={`${event.txHash}-${event.batch.id}-${event.stage}`}
                    className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf2e5] text-[10px] font-bold text-[#557148]">
                        {event.batch.organization.code}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm leading-relaxed">
                          {eventText(event)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#68756a]">
                          <StageChip stage={event.stage} />
                          <span>{event.batch.organization.name}</span>
                          <time dateTime={event.at}>· {ago(event.at)}</time>
                        </div>
                      </div>
                    </div>
                    <ExplorerLink
                      kind="tx"
                      id={event.txHash}
                      className="shrink-0 self-end text-xs sm:self-auto"
                    >
                      {ts('view_tx')}
                    </ExplorerLink>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </section>
  )
}
