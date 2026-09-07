'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { WalletIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

import { LoginMethodsProps } from './types'
import { isMobile } from '../../utils/platform'

/**
 * Único camino de entrada: conectar la wallet y firmar.
 *
 * Se fueron el magic link, Google y Apple junto con Cavos. El modal de
 * selección de wallet lo abre el Stellar Wallets Kit — Freighter, xBull, Albedo,
 * Lobstr y Rabet.
 */
export function LoginMethods({
  walletError,
  isConnecting,
  onWallet,
}: LoginMethodsProps) {
  const t = useTranslations()
  const [showMobileWalletWarning, setShowMobileWalletWarning] = useState(false)

  const handleWalletClick = () => {
    if (isMobile()) {
      setShowMobileWalletWarning(true)
    } else {
      onWallet?.()
    }
  }

  const handleWalletContinue = () => {
    setShowMobileWalletWarning(false)
    onWallet?.()
  }

  return (
    <div className="space-y-4">
      {walletError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {walletError}
        </div>
      )}

      {/* Wallet */}
      <button
        onClick={handleWalletClick}
        disabled={isConnecting}
        className="w-full bg-orange-500 text-white py-3 rounded-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <WalletIcon className="w-5 h-5" />
        {isConnecting ? t('auth.button_connecting') : t('auth.button_connect_wallet')}
      </button>

      {/* Mobile wallet warning modal */}
      {showMobileWalletWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-gray-700 text-sm">
                {t('auth.wallet_mobile_warning')}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMobileWalletWarning(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t('auth.wallet_mobile_cancel')}
              </button>
              <button
                type="button"
                onClick={handleWalletContinue}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
              >
                {t('auth.wallet_mobile_continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
