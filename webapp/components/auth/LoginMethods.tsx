'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { WalletIcon, EnvelopeIcon, ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

import { LoginMethodsProps } from './types'
import { isMobile } from '../../utils/platform'

export function LoginMethods({
  walletError,
  cavosError,
  isConnecting,
  isCavosLoading,
  isCavosEnabled,
  magicLinkSent = false,
  onWallet,
  onGoogle,
  onApple,
  onSendMagicLink,
  onEmailFormVisible,
}: LoginMethodsProps) {
  const t = useTranslations()
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [showMobileWalletWarning, setShowMobileWalletWarning] = useState(false)

  useEffect(() => {
    onEmailFormVisible?.(showEmailForm)
  }, [showEmailForm, onEmailFormVisible])
  const [email, setEmail] = useState('')

  const isBusy = isConnecting || isCavosLoading

  const handleSendMagicLink = async () => {
    if (!onSendMagicLink || !email.trim()) return
    try {
      await onSendMagicLink(email.trim())
    } catch {
      // Error is handled by cavos.error
    }
  }

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

  // Email magic-link form view
  if (showEmailForm) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setShowEmailForm(false)
            setEmail('')
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          {t('auth.back_to_options')}
        </button>

        {(walletError || cavosError) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {walletError || cavosError}
          </div>
        )}

        {magicLinkSent && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            {t('auth.magic_link_sent')}
          </div>
        )}

        <div>
          <label htmlFor="magic-link-email" className="block text-sm font-medium text-gray-700 mb-1">
            {t('auth.label_email')}
          </label>
          <input
            id="magic-link-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.placeholder_email')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
            autoComplete="email"
          />
        </div>

        <p className="text-sm text-gray-600">
          {t('auth.magic_link_help')}
        </p>

        <button
          onClick={handleSendMagicLink}
          disabled={isBusy || !email.trim()}
          className="w-full bg-orange-500 text-white py-3 rounded-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBusy ? t('auth.button_connecting') : t('auth.button_send_magic_link')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!isCavosEnabled && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
          {t('auth.cavos_unavailable')}
        </div>
      )}

      {(walletError || cavosError) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {walletError || cavosError}
        </div>
      )}

      {/* Wallet */}
      <button
        onClick={handleWalletClick}
        disabled={isBusy}
        className="w-full bg-orange-500 text-white py-3 rounded-md flex items-center justify-center gap-2"
      >
        <WalletIcon className="w-5 h-5" />
        {isBusy ? t('auth.button_connecting') : t('auth.button_connect_wallet')}
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

      {/* Divider */}
      {isCavosEnabled && (
        <>
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-300" />
            <span className="px-2 text-gray-500 text-sm">{t('auth.or')}</span>
            <div className="flex-grow border-t border-gray-300" />
          </div>

          {/* Email Magic Link */}
          {onSendMagicLink && (
            <button
              onClick={() => setShowEmailForm(true)}
              disabled={isBusy}
              className="w-full bg-white border border-gray-300 py-3 rounded-md flex items-center justify-center gap-2"
            >
              <EnvelopeIcon className="w-5 h-5" />
              <span>{t('auth.button_login_email')}</span>
            </button>
          )}

          {/* Google */}
          <button
            onClick={onGoogle}
            disabled={isBusy}
            className="w-full bg-white border border-gray-300 py-3 rounded-md flex items-center justify-center gap-2"
          >
            <Image
              src="/images/google-icon.png"
              alt="Google logo"
              width={20}
              height={20}
            />
            <span>
              {isBusy ? t('auth.button_connecting') : t('auth.button_login_google')}
            </span>
          </button>

          {/* Apple */}
          <button
            onClick={onApple}
            disabled={isBusy}
            className="w-full bg-black text-white py-3 rounded-md flex items-center justify-center gap-2"
          >
            <Image
              src="/images/apple-icon.png"
              alt="Apple logo"
              width={30}
              height={30}
            />
            <span>
              {isBusy ? t('auth.button_connecting') : t('auth.button_login_apple')}
            </span>
          </button>
        </>
      )}
    </div>
  )
}
