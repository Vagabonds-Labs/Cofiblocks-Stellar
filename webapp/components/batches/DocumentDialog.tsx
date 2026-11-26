'use client'

import { CheckCircleIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ExplorerLink } from '@/components/trace'
import { batchesService } from '@/services/api/batches'
import { walletService } from '@/services/wallet/walletService'
import { DOCUMENT_KINDS, type BatchDetail, type BatchDocument, type DocumentKind } from '@/types/traceability'

import { DialogShell } from './DialogShell'
import { signingError } from './signing'

type Step = 'form' | 'uploading' | 'preparing' | 'signing' | 'sending' | 'done'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.csv,.xlsx,.docx'

/**
 * Attaches a document to the batch: the file is stored by the backend and its
 * SHA-256 goes on chain with `attach_document`, signed by the uploader's
 * wallet. With `pending`, the file is already uploaded and only the signature
 * is missing (a previous attempt was cancelled).
 */
export function DocumentDialog({
  batch,
  pending,
  onClose,
  onDone,
}: {
  batch: BatchDetail
  pending?: BatchDocument
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations('batch')
  const [kind, setKind] = useState<DocumentKind>(pending?.kind ?? 'other')
  const [file, setFile] = useState<File | null>(null)
  const [uploaded, setUploaded] = useState<BatchDocument | null>(pending ?? null)
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BatchDocument | null>(null)

  const busy = step !== 'form' && step !== 'done'
  const tooLarge = !!file && file.size > MAX_BYTES
  const valid = !!uploaded || (!!file && !tooLarge)

  const submit = async () => {
    if (!valid) return
    setError(null)
    try {
      let doc = uploaded
      if (!doc && file) {
        setStep('uploading')
        doc = await batchesService.uploadDocument(batch.id, file, kind)
        // Kept: a cancelled signature can be retried without uploading again.
        setUploaded(doc)
        onDone()
      }
      if (!doc) return
      setStep('preparing')
      const prepared = await batchesService.prepareAttach(batch.id, doc.id)
      setStep('signing')
      const signed = await walletService.signTransaction(prepared)
      setStep('sending')
      setResult(await batchesService.attach(batch.id, doc.id, signed))
      setStep('done')
      onDone()
    } catch (err) {
      setError(signingError(err, t('error_cancelled'), t('error_generic')))
      setStep('form')
    }
  }

  return (
    <DialogShell
      title={t('doc_dialog.title')}
      subtitle={<span className="font-mono">{batch.number}</span>}
      closeLabel={t('close')}
      busy={busy}
      onClose={onClose}
    >
      {step === 'done' && result ? (
        <div className="mt-6 space-y-4" role="status">
          <p className="flex items-center gap-2 text-lg font-semibold text-[#14532d]">
            <CheckCircleIcon className="h-7 w-7 shrink-0" aria-hidden="true" />
            {t('doc_dialog.done')}
          </p>
          <p className="break-words text-sm text-[#4c5a52]">{result.fileName}</p>
          {result.txHash && (
            <ExplorerLink kind="tx" id={result.txHash}>
              {t('view_tx_long')}
            </ExplorerLink>
          )}
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
          {uploaded ? (
            <p className="rounded-2xl bg-[#f4f7f4] p-4 text-sm">
              <span className="block break-words font-semibold">{uploaded.fileName}</span>
              <span className="block text-[#5a6760]">{t('doc_dialog.uploaded_hint')}</span>
            </p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block font-medium">{t('doc_dialog.kind_label')}</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as DocumentKind)}
                  className="field-input"
                  disabled={busy}
                >
                  {DOCUMENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`kinds.${k}`)}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-1 block font-medium">{t('doc_dialog.file_label')}</span>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#cfd8d1] p-4 hover:bg-[#f4f7f4] ${busy ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eaf1ef] text-[rgb(var(--cb-primary))]">
                    <DocumentArrowUpIcon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block break-words font-semibold">{file ? file.name : t('doc_dialog.file_choose')}</span>
                    <span className={`block ${tooLarge ? 'text-red-800' : 'text-[#5a6760]'}`}>
                      {tooLarge ? t('doc_dialog.too_large') : t('doc_dialog.file_hint')}
                    </span>
                  </span>
                  <input
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </>
          )}

          <p className="text-sm text-[#5a6760]">{t('doc_dialog.hash_hint')}</p>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={!valid || busy}>
            {busy ? t(`step_${step}`) : uploaded ? t('document_sign') : t('doc_dialog.submit')}
          </button>
        </form>
      )}
    </DialogShell>
  )
}
