'use client'

import { GiftIcon } from '@heroicons/react/24/outline'

import { useDistributionClaim } from '@/hooks/profile/useDistributionClaim'

/**
 * Reparto de utilidades: lo que le toca al usuario y el botón para cobrarlo.
 *
 * Se muestra sólo cuando hay algo que reclamar. Un rol aparece acá después de
 * que el admin dispara el reparto; antes de eso el saldo es 0.
 */
export function DistributionClaims({
  walletAddress,
  onClaimed,
  t,
  simple = false,
}: {
  walletAddress: string | null
  onClaimed?: () => void
  t: any
  simple?: boolean
}) {
  const { claimable, claimingRole, error, lastTxHash, claim } =
    useDistributionClaim(walletAddress)

  if (claimable.length === 0) return null

  const handleClaim = async (role: 'CONSUMER' | 'PRODUCER' | 'ROASTER') => {
    await claim(role)
    onClaimed?.()
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <GiftIcon className="mt-0.5 h-6 w-6 flex-shrink-0 text-[rgb(40,107,86)]" />
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            {t('distribution.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t('distribution.help')}</p>

          <ul className="mt-4 flex flex-col gap-3">
            {claimable.map((entry) => (
              <li
                key={entry.role}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t(`distribution.role_${entry.role.toLowerCase()}`)}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-green-700">
                    ${entry.usd.toFixed(2)}
                    {!simple && ' USDC'}
                  </p>
                </div>
                <button
                  onClick={() => handleClaim(entry.role)}
                  disabled={claimingRole !== null}
                  className="rounded-lg bg-[rgb(40,107,86)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[rgb(30,85,68)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {claimingRole === entry.role
                    ? t('distribution.claiming')
                    : t('distribution.button_claim')}
                </button>
              </li>
            ))}
          </ul>

          {lastTxHash && (
            <p className="mt-3 break-all text-sm text-green-700">
              {t('distribution.claim_success')}{' '}
              <span className="font-mono">{!simple && lastTxHash}</span>
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  )
}
