'use client'

import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

import { LoginMethods } from '@/components/auth/LoginMethods'
import { useWalletLogin } from '@/hooks'

export default function LoginPage() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useParams()

  const wallet = useWalletLogin()

  // redirect intent
  const redirect = searchParams.get('redirect')

  // --- AUTH OBSERVER ---
  useEffect(() => {
    if (!(wallet.address && wallet.isRegistered)) return

    // cleanup stale checkout flags when it's NOT a checkout redirect
    if (redirect !== 'checkout') {
      sessionStorage.removeItem('pendingCheckout')
      sessionStorage.removeItem('checkoutRedirect')
    }

    // Redirect to home
    router.push(`/${locale}`)
  }, [wallet.address, wallet.isRegistered, redirect, router, locale])

  return (
    <div className="min-h-screen bg-white">
      <main className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
        <div className="bg-white shadow-lg p-8 rounded-lg max-w-md w-full">
          <h1 className="text-3xl font-bold mb-2">{t('auth.title_sign_in')}</h1>
          <p className="text-gray-600 mb-6">{t('auth.subtitle_login_wallet_only')}</p>

          <LoginMethods
            walletError={wallet.error}
            isConnecting={wallet.isConnecting}
            onWallet={wallet.connectWallet}
          />
        </div>
      </main>
    </div>
  )
}
