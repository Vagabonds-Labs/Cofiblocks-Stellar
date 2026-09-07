'use client'

import { CheckCircleIcon } from '@heroicons/react/24/outline'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { useUser } from '@/lib/providers/UserProvider'
import { useProfileForm, useBalances, useFundingActions } from '@/hooks'
import { ProfileForm, BalancesSection, FundingSection, TrustlineNotice, DistributionClaims } from '@/components/profile'

export default function ProfilePage() {
  const t = useTranslations()
  const router = useRouter()
  const { user, loading, error: userError, refreshUser } = useUser()

  // HOOKS
  const form = useProfileForm(user, t, refreshUser)
  const balances = useBalances(user, loading, t)
  const funding = useFundingActions(user, t)

  const error = userError || form.error || balances.balancesError || funding.error

  if (loading)
    return <p className="text-center py-12">{t('profile.loading')}</p>

  if (!user && error)
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button onClick={() => router.push('/login')} className="mt-4 bg-orange-500 px-4 py-2 text-white rounded">
          Login
        </button>
      </div>
    )

  // --- UI CLEAN ---
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-4 py-12">

        <h1 className="text-3xl font-bold mb-2">{t('profile.title')}</h1>
        <p className="text-gray-600 mb-8">{t('profile.subtitle')}</p>

        {form.success && (
          <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 p-4 rounded">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <span>{t('profile.success_message')}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* FORM */}
        <ProfileForm form={form} user={user} t={t} />

        {/* Sin trustline la cuenta no puede recibir USDC. El backend la patrocina. */}
        <TrustlineNotice
          walletAddress={user?.walletAddress ?? null}
          onCreated={balances.fetchBalances}
          t={t}
        />

        {/* BALANCES */}
        <BalancesSection balances={balances} user={user} t={t} />

        {/* Lo que le toca al usuario del reparto de utilidades, si hay algo. */}
        <DistributionClaims
          walletAddress={user?.walletAddress ?? null}
          onClaimed={balances.fetchBalances}
          t={t}
        />

        {/* FUNDING BUTTONS */}
        <div className="grid grid-cols-1 gap-4 mt-8">
          <FundingSection funding={funding} user={user} t={t} />
        </div>
      </main>
    </div>
  )
}
