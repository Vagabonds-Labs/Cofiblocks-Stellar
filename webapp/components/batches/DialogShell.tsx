'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { type ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bottom sheet on phones, centered dialog on larger screens. Escape and a
 * click outside close it, unless `busy` (a transaction is in flight).
 */
export function DialogShell({
  title,
  subtitle,
  closeLabel,
  busy = false,
  onClose,
  children,
}: {
  title: string
  subtitle?: ReactNode
  closeLabel: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('input, select, textarea')?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

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
              {title}
            </h2>
            {subtitle && <div className="mt-1 break-words text-sm text-[#5a6760]">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-[#5a6760] hover:bg-[#eef1ee] disabled:opacity-40"
            aria-label={closeLabel}
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
