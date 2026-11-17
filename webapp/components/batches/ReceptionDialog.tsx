'use client'

import { CameraIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ExplorerLink } from '@/components/trace'
import type { ApiError } from '@/lib/api'
import { batchesService } from '@/services/api/batches'
import { walletService } from '@/services/wallet/walletService'
import type { Batch, Reception } from '@/types/traceability'

type Step = 'form' | 'hashing' | 'preparing' | 'signing' | 'sending' | 'done'

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The Collector records the weight and the receipt of a delivery.
 *
 * The receipt photo never leaves the phone yet: only its SHA-256 goes on
 * chain, so the photo can later be checked against it. The backend prepares
 * `record_reception`, the Collector's wallet (Cavos or their own) signs it and
 * the backend sends it, paying the fee.
 */
export function ReceptionDialog({
  batch,
  onClose,
  onRecorded,
}: {
  batch: Batch
  onClose: () => void
  onRecorded: () => void
}) {
  const t = useTranslations('reception')
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const [weight, setWeight] = useState(batch.estimatedKg ? String(batch.estimatedKg) : '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Reception | null>(null)

  const busy = step !== 'form' && step !== 'done'
  const weightKg = Number(weight.replace(',', '.'))
  const valid = Number.isFinite(weightKg) && weightKg > 0 && weightKg <= 5000 && !!photo

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('input')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const onPhoto = (file: File | undefined) => {
    setPhoto(file ?? null)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  const submit = async () => {
    if (!valid || !photo) return
    setError(null)
    try {
      setStep('hashing')
      const input = { weightKg, receiptSha256: await sha256Hex(photo), notes: notes.trim() || null }
      setStep('preparing')
      const prepared = await batchesService.prepareReception(batch.id, input)
      setStep('signing')
      const signed = await walletService.signTransaction(prepared)
      setStep('sending')
      setResult(await batchesService.submitReception(batch.id, input, signed))
      setStep('done')
      onRecorded()
    } catch (err) {
      const apiError = err as ApiError
      // Wallet errors are the wallet's own English text; the cancellation is
      // the common one, so it gets a translated message.
      const cancelled = !apiError.statusCode && /clos|cancel|reject|denied|declin/i.test(apiError.message ?? '')
      setError(cancelled ? t('error_cancelled') : apiError.message || t('error_generic'))
      setStep('form')
    }
  }

  // Portal to <body>: cards use `backdrop-blur`, which would make this
  // `fixed` overlay position itself inside the card instead of the viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold">
              {t('title')}
            </h2>
            <p className="mt-1 break-words font-mono text-sm text-[#5a6760]">{batch.number}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-[#5a6760] hover:bg-[#eef1ee] disabled:opacity-40"
            aria-label={t('close')}
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {step === 'done' && result ? (
          <div className="mt-6 space-y-4" role="status">
            <p className="flex items-center gap-2 text-lg font-semibold text-[#14532d]">
              <CheckCircleIcon className="h-7 w-7" aria-hidden="true" />
              {t('done', { kg: Number(result.weight_grams) / 1000 })}
            </p>
            <p className="text-sm text-[#4c5a52]">{t('done_text')}</p>
            <ExplorerLink kind="tx" id={result.tx_hash}>
              {t('view_tx')}
            </ExplorerLink>
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
            <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-[#f4f7f4] p-4 text-sm">
              <div>
                <dt className="text-[#5a6760]">{t('farmer')}</dt>
                <dd className="font-mono font-semibold">{batch.farmerRef}</dd>
              </div>
              <div>
                <dt className="text-[#5a6760]">{t('estimated')}</dt>
                <dd className="font-semibold">{batch.estimatedKg != null ? `${batch.estimatedKg} kg` : '—'}</dd>
              </div>
            </dl>

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

            <div>
              <span className="mb-1 block font-medium">{t('photo_label')}</span>
              <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#cfd8d1] p-4 hover:bg-[#f4f7f4] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
                {preview ? (
                  <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#eaf1ef] text-[rgb(var(--cb-primary))]">
                    <CameraIcon className="h-7 w-7" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold">{photo ? photo.name : t('photo_choose')}</span>
                  <span className="block text-[#5a6760]">{t('photo_hint')}</span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => onPhoto(e.target.files?.[0])}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block font-medium">{t('notes_label')}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={busy}
                rows={2}
                maxLength={500}
                className="field-input"
              />
            </label>

            <p className="text-sm text-[#5a6760]">{t('immutable_hint')}</p>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={!valid || busy}>
              {busy ? t(`step_${step}`) : t('submit')}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
