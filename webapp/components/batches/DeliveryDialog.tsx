'use client'

import { CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

import type { ApiError } from '@/lib/api'
import { deliveriesService } from '@/services/api/deliveries'
import type { CollectionCenter, Delivery, DeliveryFarmer } from '@/types/traceability'

import { DialogShell } from './DialogShell'

/** `YYYY-MM-DDTHH:mm` in local time, for `<input type="datetime-local">`. */
function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The Collector records a delivery at the collection center: farmer, center,
 * weight on the scale and time. Nothing goes on chain yet: the farmer is asked
 * in the VoiceLedger bot to confirm it, and only then is the batch created.
 */
export function DeliveryDialog({
  centers,
  defaultCenterId,
  onClose,
  onCreated,
}: {
  centers: CollectionCenter[]
  defaultCenterId: string | null
  onClose: () => void
  onCreated: (delivery: Delivery) => void
}) {
  const t = useTranslations('deliveries')
  const [search, setSearch] = useState('')
  const [farmers, setFarmers] = useState<DeliveryFarmer[] | null>(null)
  const [farmer, setFarmer] = useState<DeliveryFarmer | null>(null)
  const [centerId, setCenterId] = useState(defaultCenterId ?? centers[0]?.id ?? '')
  const [weight, setWeight] = useState('')
  const [when, setWhen] = useState(() => localInputValue(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Delivery | null>(null)

  useEffect(() => {
    let current = true
    const timer = setTimeout(
      () =>
        deliveriesService
          .farmers(search.trim())
          .then((list) => current && setFarmers(list))
          .catch((err: ApiError) => current && setError(err.message)),
      search ? 300 : 0
    )
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [search])

  const weightKg = Number(weight.replace(',', '.'))
  const deliveredAt = useMemo(() => new Date(when), [when])
  const validDate = Number.isFinite(deliveredAt.getTime()) && deliveredAt.getTime() <= Date.now() + 5 * 60_000
  const valid =
    !!farmer && farmer.linked && farmer.consented && !!centerId && Number.isFinite(weightKg) && weightKg > 0 && weightKg <= 5000 && validDate

  const submit = async () => {
    if (!valid || !farmer) return
    setBusy(true)
    setError(null)
    try {
      const delivery = await deliveriesService.create({
        farmerId: farmer.id,
        collectionCenterId: centerId,
        weightKg,
        deliveredAt: deliveredAt.toISOString(),
      })
      setCreated(delivery)
      onCreated(delivery)
    } catch (err) {
      setError((err as ApiError).message || t('error_generic'))
    } finally {
      setBusy(false)
    }
  }

  const reason = (f: DeliveryFarmer) => (!f.linked ? t('not_linked') : !f.consented ? t('not_consented') : null)

  return (
    <DialogShell title={t('dialog_title')} subtitle={t('dialog_subtitle')} closeLabel={t('close')} busy={busy} onClose={onClose}>
      {created ? (
        <div className="mt-6 space-y-4" role="status">
          <p className="flex items-center gap-2 text-lg font-semibold text-[#14532d]">
            <CheckCircleIcon className="h-7 w-7 shrink-0" aria-hidden="true" />
            {t('sent', { kg: created.weightKg })}
          </p>
          <p className="text-sm text-[#4c5a52]">{t('sent_text', { farmer: created.farmerName || created.farmerRef })}</p>
          <button type="button" className="btn-primary mt-2 w-full py-3" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <fieldset>
            <legend className="mb-1 font-medium">{t('farmer_label')}</legend>
            <label className="relative block">
              <span className="sr-only">{t('farmer_search')}</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a968f]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('farmer_search')}
                className="field-input pl-10"
                disabled={busy}
              />
            </label>
            <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto" aria-busy={farmers === null}>
              {farmers === null ? (
                <div className="h-12 animate-pulse rounded-xl bg-[#eef1ee]" />
              ) : farmers.length === 0 ? (
                <p className="rounded-xl bg-[#f4f7f4] p-3 text-sm text-[#5a6760]">{t('no_farmers')}</p>
              ) : (
                farmers.map((f) => {
                  const blocked = reason(f)
                  const selected = farmer?.id === f.id
                  return (
                    <label
                      key={f.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${
                        selected ? 'border-[rgb(var(--cb-primary))] bg-[#eaf1ef]' : 'border-[#e3e8e4]'
                      } ${blocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-[#f4f7f4]'}`}
                    >
                      <input
                        type="radio"
                        name="farmer"
                        className="h-4 w-4"
                        checked={selected}
                        disabled={!!blocked || busy}
                        onChange={() => {
                          setFarmer(f)
                          if (!defaultCenterId && f.collectionCenterId) setCenterId(f.collectionCenterId)
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{f.name || f.farmerRef}</span>
                        <span className="block font-mono text-xs text-[#5a6760]">{f.farmerRef}</span>
                        {blocked && <span className="block text-xs text-[#8a4b12]">{blocked}</span>}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-medium">{t('center_label')}</span>
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="field-input" disabled={busy} required>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">{t('weight_label')}</span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  disabled={busy}
                  className="field-input pr-12 text-lg"
                  placeholder="45.5"
                  required
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5a6760]">kg</span>
              </div>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block font-medium">{t('when_label')}</span>
            <input
              type="datetime-local"
              value={when}
              max={localInputValue(new Date())}
              onChange={(e) => setWhen(e.target.value)}
              disabled={busy}
              className="field-input"
              required
            />
          </label>

          <p className="text-sm text-[#5a6760]">{t('confirm_hint')}</p>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={!valid || busy}>
            {busy ? t('sending') : t('submit')}
          </button>
        </form>
      )}
    </DialogShell>
  )
}
