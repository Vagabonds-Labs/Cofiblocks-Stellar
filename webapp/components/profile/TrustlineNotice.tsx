'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

import { useUSDCTrustline } from '@/hooks/auth/useUSDCTrustline'

/**
 * Alta de la trustline a USDC, patrocinada por el backend.
 *
 * Una cuenta de Stellar no puede recibir USDC hasta que abre la trustline, y
 * abrirla inmoviliza reservas en XLM. Las pone el backend, así un usuario nuevo
 * compra café sin tener un solo XLM.
 */
export function TrustlineNotice({
  walletAddress,
  onCreated,
  t,
}: {
  walletAddress: string | null
  onCreated?: () => void
  t: any
}) {
  const { isRequired, isCreating, error, errorCode, createTrustline } =
    useUSDCTrustline(walletAddress)

  const errorText =
    errorCode && t.has?.(`api_errors.${errorCode}`)
      ? t(`api_errors.${errorCode}`)
      : t('balances.trustline_error')

  if (!isRequired) return null

  const handleClick = async () => {
    await createTrustline()
    onCreated?.()
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="font-medium text-amber-900">{t('balances.trustline_required_title')}</p>
          <p className="mt-1 text-sm text-amber-800">
            {t('balances.trustline_required_message')}
          </p>
          {error && <p className="mt-2 text-sm text-red-700">{errorText}</p>}
          <button
            onClick={handleClick}
            disabled={isCreating}
            className="mt-3 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white
                       hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating
              ? t('balances.trustline_creating')
              : t('balances.trustline_button_create')}
          </button>
        </div>
      </div>
    </div>
  )
}
