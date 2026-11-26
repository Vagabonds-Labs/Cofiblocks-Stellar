'use client'

import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ExplorerLink } from '@/components/trace'
import { batchesService } from '@/services/api/batches'
import { walletService } from '@/services/wallet/walletService'
import type { BatchDetail, BatchStage, StageStep } from '@/types/traceability'

import { DialogShell } from './DialogShell'
import { signingError } from './signing'

type Step = 'form' | 'preparing' | 'signing' | 'sending' | 'done'

/**
 * Industry Manager, Store Keeper or Export Manager: moves the batch to its
 * next stage with a short note and, optionally, the weight after the stage.
 * The backend prepares `advance_stage`, the wallet signs it and the backend
 * sends it, paying the fee. The contract checks role, cooperative and order.
 */
export function StageDialog({
  batch,
  stages,
  onClose,
  onDone,
}: {
  batch: BatchDetail
  /** The stages the viewer can move it to (from `nextStages`). */
  stages: BatchStage[]
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations('batch')
  const ts = useTranslations('stages')
  const [stage, setStage] = useState<BatchStage>(stages[0])
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<StageStep | null>(null)

  const busy = step !== 'form' && step !== 'done'
  const weightKg = weight.trim() ? Number(weight.replace(',', '.')) : null
  const valid = weightKg === null || (Number.isFinite(weightKg) && weightKg > 0 && weightKg <= 5000)

  const submit = async () => {
    if (!valid) return
    setError(null)
    try {
      const input = { stage, weightKg, notes: notes.trim() || null }
      setStep('preparing')
      const prepared = await batchesService.prepareStage(batch.id, input)
      setStep('signing')
      const signed = await walletService.signTransaction(prepared)
      setStep('sending')
      setResult(await batchesService.submitStage(batch.id, input, signed))
      setStep('done')
      onDone()
    } catch (err) {
      setError(signingError(err, t('error_cancelled'), t('error_generic')))
      setStep('form')
    }
  }

  return (
    <DialogShell
      title={t('stage_dialog.title')}
      subtitle={<span className="font-mono">{batch.number}</span>}
      closeLabel={t('close')}
      busy={busy}
      onClose={onClose}
    >
      {step === 'done' && result ? (
        <div className="mt-6 space-y-4" role="status">
          <p className="flex items-center gap-2 text-lg font-semibold text-[#14532d]">
            <CheckCircleIcon className="h-7 w-7 shrink-0" aria-hidden="true" />
            {t('stage_dialog.done', { stage: ts(result.stage) })}
          </p>
          <ExplorerLink kind="tx" id={result.tx_hash}>
            {t('view_tx_long')}
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
          {stages.length > 1 ? (
            <fieldset>
              <legend className="mb-1 font-medium">{t('stage_dialog.stage_label')}</legend>
              <div className="space-y-2">
                {stages.map((s) => (
                  <label
                    key={s}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                      stage === s ? 'border-[rgb(var(--cb-primary))] bg-[#eaf1ef]' : 'border-[#e3e8e4]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stage"
                      className="h-4 w-4"
                      checked={stage === s}
                      disabled={busy}
                      onChange={() => setStage(s)}
                    />
                    <span className="font-semibold">{ts(s)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="rounded-2xl bg-[#f4f7f4] p-4">
              <span className="block text-sm text-[#5a6760]">{t('stage_dialog.stage_label')}</span>
              <span className="text-lg font-semibold">
                {ts(batch.stage)} → {ts(stage)}
              </span>
            </p>
          )}

          <label className="block">
            <span className="mb-1 block font-medium">{t('stage_dialog.weight_label')}</span>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={busy}
                className="field-input pr-12"
                aria-describedby="stage-weight-hint"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5a6760]">kg</span>
            </div>
            <span id="stage-weight-hint" className="mt-1 block text-sm text-[#5a6760]">
              {t('stage_dialog.weight_hint')}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block font-medium">{t('stage_dialog.notes_label')}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
              rows={3}
              maxLength={500}
              className="field-input"
            />
          </label>

          <p className="text-sm text-[#5a6760]">{t('stage_dialog.immutable_hint')}</p>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={!valid || busy}>
            {busy ? t(`step_${step}`) : t('stage_dialog.submit')}
          </button>
        </form>
      )}
    </DialogShell>
  )
}
