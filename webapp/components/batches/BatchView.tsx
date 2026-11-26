'use client'

import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  PaperClipIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { ExplorerLink } from '@/components/trace'
import { saveBlob, type ApiError } from '@/lib/api'
import { batchesService } from '@/services/api/batches'
import type { BatchDetail, BatchDocument, BatchEvent, BatchStage, BatchVerification } from '@/types/traceability'

import { DocumentDialog } from './DocumentDialog'
import { StageChip } from './StageChip'
import { StageDialog } from './StageDialog'

type Dialog = { kind: 'stage'; stage: BatchStage } | { kind: 'document'; pending?: BatchDocument } | null

/**
 * One batch: who did what and when, each step with its transaction, the
 * documents, and "Verified on Stellar" (the stored history compared with the
 * contract). Staff whose role continues the batch move it forward from here.
 */
export function BatchView({ id }: { id: string }) {
  const t = useTranslations('batch')
  const ts = useTranslations('stages')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [verifyKey, setVerifyKey] = useState(0)

  const load = useCallback(async () => {
    try {
      setBatch(await batchesService.get(id))
      setError(null)
    } catch (err) {
      setError(err as ApiError)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const changed = useCallback(() => {
    load()
    setVerifyKey((k) => k + 1)
  }, [load])

  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

  if (error) {
    return (
      <div className="surface-card p-8 text-center" role="alert">
        <p className="text-red-800">{error.statusCode === 404 ? t('not_found') : error.message}</p>
        <div className="mt-4 flex justify-center gap-3">
          <BackLink />
          {error.statusCode !== 404 && (
            <button type="button" className="btn-secondary" onClick={load}>
              {tc('retry')}
            </button>
          )}
        </div>
      </div>
    )
  }
  if (!batch) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-32 animate-pulse rounded-3xl bg-white/70" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/70" />
      </div>
    )
  }

  const kg = batch.weightKg ?? batch.confirmedKg
  const facts = [
    { label: t('farmer'), value: <span className="font-mono">{batch.farmerRef}</span> },
    { label: t('cooperative'), value: batch.organization.name },
    { label: t('center'), value: batch.collectionCenter.name },
    { label: t('delivered'), value: date(batch.deliveredAt) },
    {
      label: batch.weightKg != null ? t('weight') : t('confirmed_kg'),
      value: kg != null ? `${kg} kg` : '—',
    },
  ]
  const canAct = batch.nextStages.length > 0 || batch.canAttach

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-[#5a6760]">{t('batch_label')}</p>
            <h1 className="break-words font-mono text-xl font-bold sm:text-3xl">{batch.number}</h1>
          </div>
          <StageChip stage={batch.stage} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[#5a6760]">{f.label}</dt>
              <dd className="mt-0.5 break-words font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>
        <Verification batchId={batch.id} refreshKey={verifyKey} />
      </header>

      {canAct && (
        <section className="surface-card p-5 sm:p-6" aria-labelledby="actions-title">
          <h2 id="actions-title" className="text-lg font-bold">
            {t('actions_title')}
          </h2>
          {batch.stageInFlight && <p className="mt-2 text-sm text-[#8a4b12]">{t('stage_in_flight')}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            {batch.nextStages.map((stage) => (
              <button
                key={stage}
                type="button"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
                onClick={() => setDialog({ kind: 'stage', stage })}
              >
                {t('advance_to', { stage: ts(stage) })}
                <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            ))}
            {batch.canAttach && (
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5"
                onClick={() => setDialog({ kind: 'document' })}
              >
                <PaperClipIcon className="h-5 w-5" aria-hidden="true" />
                {t('attach')}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface-card p-5 sm:p-6" aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="text-lg font-bold">
            {t('timeline_title')}
          </h2>
          <ol className="mt-4 space-y-0">
            {batch.events.map((event, i) => (
              <TimelineItem key={event.txHash} event={event} last={i === batch.events.length - 1} date={date} />
            ))}
          </ol>
        </section>

        <section className="surface-card p-5 sm:p-6" aria-labelledby="documents-title">
          <h2 id="documents-title" className="text-lg font-bold">
            {t('documents_title')}
          </h2>
          {batch.documents.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-[#f4f7f4] p-4 text-sm text-[#5a6760]">{t('documents_empty')}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {batch.documents.map((doc) => (
                <DocumentItem
                  key={doc.id}
                  batchId={batch.id}
                  doc={doc}
                  date={date}
                  onSign={() => setDialog({ kind: 'document', pending: doc })}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {dialog?.kind === 'stage' && (
        <StageDialog batch={batch} stages={[dialog.stage]} onClose={() => setDialog(null)} onDone={changed} />
      )}
      {dialog?.kind === 'document' && (
        <DocumentDialog batch={batch} pending={dialog.pending} onClose={() => setDialog(null)} onDone={changed} />
      )}
    </div>
  )
}

function BackLink() {
  const t = useTranslations('batch')
  const locale = useLocale()
  return (
    <Link
      href={`/${locale}#batches-title`}
      className="inline-flex items-center gap-2 text-sm font-semibold text-[rgb(var(--cb-primary))] hover:underline"
    >
      <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
      {t('back')}
    </Link>
  )
}

function Verification({ batchId, refreshKey }: { batchId: string; refreshKey: number }) {
  const t = useTranslations('batch')
  const [result, setResult] = useState<BatchVerification | null>(null)
  const [failed, setFailed] = useState(false)
  const [checking, setChecking] = useState(true)

  const check = useCallback(async () => {
    setChecking(true)
    setFailed(false)
    try {
      setResult(await batchesService.verify(batchId))
    } catch {
      setFailed(true)
    } finally {
      setChecking(false)
    }
  }, [batchId])

  useEffect(() => {
    check()
  }, [check, refreshKey])

  const box = 'mt-5 flex flex-wrap items-start gap-3 rounded-2xl p-4 text-sm'
  if (checking && !result) {
    return (
      <p className={`${box} bg-[#f4f7f4] text-[#5a6760]`} aria-live="polite">
        {t('verify_checking')}
      </p>
    )
  }
  if (failed || !result) {
    return (
      <div className={`${box} bg-[#f4f7f4]`} role="status">
        <p className="flex-1 text-[#5a6760]">{t('verify_error')}</p>
        <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={check}>
          {t('verify_again')}
        </button>
      </div>
    )
  }
  const ok = result.verified
  return (
    <div className={`${box} ${ok ? 'bg-[#e6f2ea] text-[#14532d]' : 'bg-red-50 text-red-800'}`} role="status" aria-live="polite">
      {ok ? (
        <ShieldCheckIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
      ) : (
        <ExclamationTriangleIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-[12rem] flex-1">
        <p className="font-semibold">{ok ? t('verified') : t('not_verified')}</p>
        <p className="mt-0.5">
          {ok
            ? t('verified_text', { steps: result.steps.length, docs: result.documents.length })
            : t('not_verified_text')}
        </p>
      </div>
      <button
        type="button"
        className="rounded-full px-3 py-1.5 text-sm font-semibold underline-offset-4 hover:underline disabled:opacity-50"
        onClick={check}
        disabled={checking}
      >
        {checking ? t('verify_checking') : t('verify_again')}
      </button>
    </div>
  )
}

function TimelineItem({ event, last, date }: { event: BatchEvent; last: boolean; date: (iso: string) => string }) {
  const t = useTranslations('batch')
  const ts = useTranslations('stages')
  const tr = useTranslations('roles')
  const notes = typeof event.data.notes === 'string' ? event.data.notes : null
  const weightKg =
    typeof event.data.weight_kg === 'number'
      ? event.data.weight_kg
      : typeof event.data.weight_grams === 'string'
        ? Number(event.data.weight_grams) / 1000
        : null
  const who =
    event.stage === 'DELIVERED'
      ? t('by_farmer_agent')
      : [event.actor?.name, event.actor?.role ? tr(event.actor.role) : null].filter(Boolean).join(' · ') ||
        `${event.actorAddress.slice(0, 6)}…${event.actorAddress.slice(-4)}`

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && <span className="absolute left-[7px] top-5 h-full w-0.5 bg-[#dfe6e0]" aria-hidden="true" />}
      <span className="relative mt-1.5 h-4 w-4 shrink-0 rounded-full border-4 border-white bg-[rgb(var(--cb-primary))] shadow" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-semibold">{ts(event.stage)}</p>
          <time className="text-sm text-[#5a6760]" dateTime={event.at}>
            {date(event.at)}
          </time>
        </div>
        <p className="text-sm text-[#5a6760]">{t('by', { who })}</p>
        {weightKg != null && <p className="mt-1 text-sm">{t('weight_value', { kg: weightKg })}</p>}
        {notes && <p className="mt-1 whitespace-pre-line break-words text-sm">{notes}</p>}
        {!event.dataHashMatches && <p className="mt-1 text-sm font-semibold text-red-800">{t('record_mismatch')}</p>}
        <ExplorerLink kind="tx" id={event.txHash} className="mt-1 text-sm">
          {t('view_tx')}
        </ExplorerLink>
      </div>
    </li>
  )
}

function DocumentItem({
  batchId,
  doc,
  date,
  onSign,
}: {
  batchId: string
  doc: BatchDocument
  date: (iso: string) => string
  onSign: () => void
}) {
  const t = useTranslations('batch')
  const tr = useTranslations('roles')
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setDownloading(true)
    setError(null)
    try {
      const { blob, fileName } = await batchesService.downloadDocument(batchId, doc.id)
      saveBlob(blob, fileName ?? doc.fileName)
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setDownloading(false)
    }
  }

  const who = [doc.uploadedBy?.name, doc.uploadedBy?.role ? tr(doc.uploadedBy.role) : null].filter(Boolean).join(' · ')
  const size = doc.sizeBytes >= 1024 * 1024 ? `${(doc.sizeBytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(doc.sizeBytes / 1024))} KB`

  return (
    <li className="rounded-2xl border border-[#e3e8e4] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold">{doc.fileName}</p>
          <p className="text-sm text-[#5a6760]">
            {t(`kinds.${doc.kind}`)} · {size}
          </p>
          <p className="text-sm text-[#5a6760]">{[who, date(doc.attachedAt ?? doc.uploadedAt)].filter(Boolean).join(' · ')}</p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="shrink-0 rounded-full p-2 text-[rgb(var(--cb-primary))] hover:bg-[#eaf1ef] disabled:opacity-50"
          aria-label={t('download', { name: doc.fileName })}
        >
          <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-[#5a6760]" title="SHA-256">
        {doc.sha256}
      </p>
      <div className="mt-2 text-sm">
        {doc.txHash ? (
          <ExplorerLink kind="tx" id={doc.txHash}>
            {t('view_tx')}
          </ExplorerLink>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip chip-warm">{t('document_pending')}</span>
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={onSign}>
              {t('document_sign')}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </li>
  )
}
