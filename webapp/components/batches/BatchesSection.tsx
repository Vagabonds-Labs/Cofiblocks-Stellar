'use client'

import { ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ExplorerLink } from '@/components/trace'
import { saveBlob, type ApiError } from '@/lib/api'
import { batchesService } from '@/services/api/batches'
import { organizationsService } from '@/services/api/organizations'
import {
  BATCH_STAGES,
  type BatchesPage,
  type BatchStage,
  type Organization,
} from '@/types/traceability'

import { StageChip } from './StageChip'

/**
 * Every batch in the pilot, filterable by cooperative and stage (the counts
 * per stage double as the filter), with a link to the on-chain record of each
 * step. The cooperative filter is shared with the overview cards.
 */
export function BatchesSection({
  refreshKey,
  cooperativeId,
  onCooperativeChange,
}: {
  refreshKey: number
  cooperativeId: string
  onCooperativeChange: (id: string) => void
}) {
  const t = useTranslations('batches')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [page, setPage] = useState<BatchesPage | null>(null)
  const [stage, setStage] = useState<BatchStage | null>(null)
  const coopId = cooperativeId
  const [cooperatives, setCooperatives] = useState<Organization[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const requestId = useRef(0)

  /** The CSV has the same filters as the table. */
  const exportCsv = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const { blob, fileName } = await batchesService.exportCsv({
        stage: stage ?? undefined,
        organizationId: coopId || undefined,
        search: search.trim() || undefined,
      })
      saveBlob(blob, fileName ?? 'cofiblocks-batches.csv')
    } catch (err) {
      setExportError((err as ApiError).message)
    } finally {
      setExporting(false)
    }
  }

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    setPage(null)
    try {
      const result = await batchesService.list({
        stage: stage ?? undefined,
        organizationId: coopId || undefined,
        search: search.trim() || undefined,
        limit: 50,
      })
      if (id === requestId.current) setPage(result)
    } catch (err) {
      if (id === requestId.current) setError((err as ApiError).message)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [stage, coopId, search])

  useEffect(() => {
    organizationsService
      .list()
      .then((orgs) =>
        setCooperatives(orgs.filter((o) => o.kind === 'COOPERATIVE'))
      )
      .catch(() => setCooperatives([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0)
    return () => {
      clearTimeout(timer)
      requestId.current++
    }
  }, [load, search, refreshKey])

  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
      new Date(iso)
    )
  const totalAll = page
    ? Object.values(page.stageCounts).reduce((sum, n) => sum + (n ?? 0), 0)
    : 0
  const stagesWithBatches = BATCH_STAGES.filter(
    (s) => (page?.stageCounts[s] ?? 0) > 0
  )

  return (
    <section className="space-y-3" aria-labelledby="batches-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="batches-title"
            tabIndex={-1}
            className="scroll-mt-28 text-lg font-bold focus:outline-none"
          >
            {t('title')}
          </h2>
          <p className="text-sm text-[#5a6760]">{t('subtitle')}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="sm:w-52">
            <span className="sr-only">{t('filter_coop')}</span>
            <select
              value={coopId}
              onChange={(e) => onCooperativeChange(e.target.value)}
              className="field-input"
            >
              <option value="">{t('all_coops')}</option>
              {cooperatives.map((coop) => (
                <option key={coop.id} value={coop.id}>
                  {coop.name}
                </option>
              ))}
            </select>
          </label>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">{t('search')}</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a968f]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="field-input pl-10"
            />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || !page || page.total === 0}
            className="btn-secondary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5"
          >
            <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
            {exporting ? t('exporting') : t('export_csv')}
          </button>
        </div>
      </div>
      {exportError && (
        <p role="alert" className="text-sm text-red-800">
          {exportError}
        </p>
      )}

      {page && totalAll > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('filter_stage')}
        >
          <button
            type="button"
            onClick={() => setStage(null)}
            aria-pressed={stage === null}
            className={`chip border ${stage === null ? 'border-[rgb(var(--cb-primary))] bg-[#eaf1ef] text-[rgb(var(--cb-primary))]' : 'chip-neutral border-transparent'}`}
          >
            {t('all', { count: totalAll })}
          </button>
          {stagesWithBatches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(stage === s ? null : s)}
              aria-pressed={stage === s}
              className={`chip border ${stage === s ? 'border-[rgb(var(--cb-primary))] bg-[#eaf1ef] text-[rgb(var(--cb-primary))]' : 'chip-neutral border-transparent'}`}
            >
              {t('stage_count', {
                stage: t(`stage_short.${s}`),
                count: page.stageCounts[s] ?? 0,
              })}
            </button>
          ))}
        </div>
      )}

      <div className="surface-card overflow-x-auto">
        {loading && !page ? (
          <div className="space-y-3 p-6" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-[#eef1ee]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center" role="alert">
            <p className="text-red-800">{error}</p>
            <button type="button" className="btn-secondary mt-4" onClick={load}>
              {tc('retry')}
            </button>
          </div>
        ) : !page || page.batches.length === 0 ? (
          <p className="p-8 text-center text-[#5a6760]">
            {stage || search || coopId ? t('empty_filtered') : t('empty')}
          </p>
        ) : (
          <table className="data-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">{t('col_batch')}</th>
                <th scope="col">{t('col_coop')}</th>
                <th scope="col">{t('col_center')}</th>
                <th scope="col">{t('col_stage')}</th>
                <th scope="col" className="text-right">
                  {t('col_kg')}
                </th>
                <th scope="col">{t('col_onchain')}</th>
              </tr>
            </thead>
            <tbody>
              {page.batches.map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <Link
                      href={`/${locale}/batches/${batch.id}`}
                      className="font-mono font-semibold text-[rgb(var(--cb-primary))] underline-offset-4 hover:underline"
                    >
                      {batch.number}
                    </Link>
                    <p className="text-xs text-[#5a6760]">
                      {date(batch.deliveredAt)}
                    </p>
                  </td>
                  <td>{batch.organization.code}</td>
                  <td>{batch.collectionCenter.name}</td>
                  <td>
                    <StageChip stage={batch.stage} />
                  </td>
                  <td className="text-right tabular-nums">
                    {batch.weightKg != null ? (
                      <span className="font-semibold">{batch.weightKg}</span>
                    ) : batch.estimatedKg != null ? (
                      <span
                        className="text-[#5a6760]"
                        title={t('estimated_hint')}
                      >
                        ~{batch.estimatedKg}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1 text-sm">
                      {batch.createTx && (
                        <ExplorerLink kind="tx" id={batch.createTx}>
                          {t('tx_delivery')}
                        </ExplorerLink>
                      )}
                      {batch.receptionTx && (
                        <ExplorerLink kind="tx" id={batch.receptionTx}>
                          {t('tx_reception')}
                        </ExplorerLink>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {page && !error && page.total > page.batches.length && (
        <p className="text-sm text-[#5a6760]">
          {t('showing', { shown: page.batches.length, total: page.total })}
        </p>
      )}
    </section>
  )
}
