'use client'

import { PlusIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { ApiError } from '@/lib/api'
import { deliveriesService } from '@/services/api/deliveries'
import { organizationsService } from '@/services/api/organizations'
import type { CollectionCenter, Delivery, DeliveryStatus } from '@/types/traceability'

import { DeliveryDialog } from './DeliveryDialog'

/** While a delivery waits for the farmer, check for their answer this often. */
const POLL_MS = 10_000
const SHOWN = 8

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  PENDING: 'chip-warm',
  CONFIRMED: 'bg-[#e6f2ea] text-[#14532d]',
  REJECTED: 'bg-red-50 text-red-800',
  CANCELLED: 'chip-neutral',
  EXPIRED: 'chip-neutral',
}

/**
 * Collector: records deliveries at the collection center and follows the
 * farmer's answer in the bot. A confirmed one becomes a batch and moves to
 * "Deliveries to weigh", where the Collector signs the weight.
 */
export function RecordedDeliveries({
  organizationId,
  collectionCenterId,
  refreshKey,
  onConfirmed,
}: {
  organizationId: string | null
  collectionCenterId: string | null
  refreshKey: number
  onConfirmed: () => void
}) {
  const t = useTranslations('deliveries')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null)
  const [centers, setCenters] = useState<CollectionCenter[]>([])
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const pendingIds = useRef<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const list = await deliveriesService.list()
      setError(null)
      setDeliveries(list)
      // A delivery we saw waiting is now confirmed: its batch is ready to weigh.
      const confirmedNow = list.some((d) => d.status === 'CONFIRMED' && d.batch && pendingIds.current.has(d.id))
      pendingIds.current = new Set(list.filter((d) => d.status === 'PENDING').map((d) => d.id))
      if (confirmedNow) onConfirmed()
    } catch (err) {
      setError((err as ApiError).message)
    }
  }, [onConfirmed])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const waiting = deliveries?.some((d) => d.status === 'PENDING') ?? false
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [waiting, load])

  useEffect(() => {
    organizationsService
      .list()
      .then((orgs) => setCenters(orgs.find((o) => o.id === organizationId)?.collectionCenters ?? []))
      .catch(() => setCenters([]))
  }, [organizationId])

  const cancel = async (id: string) => {
    setCancelling(id)
    try {
      await deliveriesService.cancel(id)
      await load()
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setCancelling(null)
    }
  }

  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  const shown = deliveries?.slice(0, SHOWN) ?? []
  const pendingCount = deliveries?.filter((d) => d.status === 'PENDING').length ?? 0

  return (
    <section className="surface-card p-5 sm:p-6" aria-labelledby="recorded-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 id="recorded-title" className="text-lg font-bold">
              {t('title')}
            </h2>
            {pendingCount > 0 && <span className="chip chip-warm">{t('waiting_count', { count: pendingCount })}</span>}
          </div>
          <p className="mt-1 text-sm text-[#5a6760]">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex shrink-0 items-center gap-2 px-4 py-2.5"
          onClick={() => setRecording(true)}
          disabled={centers.length === 0}
        >
          <PlusIcon className="h-5 w-5" aria-hidden="true" />
          {t('record')}
        </button>
      </div>

      {error ? (
        <div className="mt-4" role="alert">
          <p className="text-sm text-red-800">{error}</p>
          <button type="button" className="btn-secondary mt-3 text-sm" onClick={load}>
            {tc('retry')}
          </button>
        </div>
      ) : deliveries === null ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#eef1ee]" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[#f4f7f4] p-4 text-center text-sm text-[#5a6760]">{t('empty')}</p>
      ) : (
        <ul className="mt-4 space-y-3" aria-live="polite">
          {shown.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-2xl border border-[#e3e8e4] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {d.farmerName || d.farmerRef} · {t('kg', { kg: d.weightKg })}
                </p>
                <p className="mt-1 text-sm text-[#5a6760]">
                  <span className="font-mono">{d.farmerRef}</span> · {d.collectionCenter.name} · {time(d.deliveredAt)}
                </p>
                <p className="mt-1 text-sm text-[#5a6760]">
                  {d.status === 'PENDING'
                    ? t('waiting_until', { time: time(d.expiresAt) })
                    : d.status === 'CONFIRMED' && d.batch
                      ? t('confirmed_batch', { batch: d.batch.number })
                      : t(`status_hint.${d.status}`)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`chip ${STATUS_STYLE[d.status]}`}>{t(`status.${d.status}`)}</span>
                {d.status === 'PENDING' && (
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-sm"
                    onClick={() => cancel(d.id)}
                    disabled={cancelling === d.id}
                  >
                    {t('cancel')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {recording && (
        <DeliveryDialog
          centers={centers}
          defaultCenterId={collectionCenterId}
          onClose={() => setRecording(false)}
          onCreated={() => load()}
        />
      )}
    </section>
  )
}
