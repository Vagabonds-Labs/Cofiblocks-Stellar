'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useUser } from '@/lib/providers/UserProvider'
import { onchainService } from '@/services/api/onchain'
import { ContractsInfoResponse } from '@/services/api/onchain/types'
import { BalanceCard } from '@/components/profile/BalanceCard'
import { formatBalance } from '@/utils/formatting'
import { PaymentToken } from '@/types/contracts'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

function shortenAddress(address: string, chars = 4) {
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
  }

export default function ManageContractsPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const { user, loading: userLoading } = useUser()
  
  const [contractsInfo, setContractsInfo] = useState<ContractsInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [distributing, setDistributing] = useState(false)

  // Check if user is admin and redirect if not
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        router.push(`/${locale}/login?redirect=admin/contracts`)
        return
      }
      if (!user.isAdmin) {
        router.push(`/${locale}`)
        return
      }
    }
  }, [user, userLoading, router, locale])

  // Fetch contracts info
  const fetchContractsInfo = async () => {
    if (!user?.isAdmin) return
    
    setLoading(true)
    setError(null)
    
    try {
      const data = await onchainService.getContractsInfo()
      setContractsInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_contracts.error_fetch'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.isAdmin) {
      fetchContractsInfo()
    }
  }, [user?.isAdmin])

  const handleDistribute = async () => {
    if (!confirm(t('admin_contracts.confirm_distribute'))) {
      return
    }

    setDistributing(true)
    try {
      // TODO: Implement distribute endpoint call
      // await onchainService.distribute()
      alert(t('admin_contracts.distribute_coming_soon'))
    } catch (err) {
      alert(err instanceof Error ? err.message : t('admin_contracts.error_distribute'))
    } finally {
      setDistributing(false)
    }
  }

  if (userLoading || !user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('admin_contracts.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('admin_contracts.loading_contracts')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">{t('admin_contracts.error')}</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchContractsInfo}
              className="mt-3 text-sm underline hover:text-red-800"
            >
              {t('admin_contracts.try_again')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!contractsInfo) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('admin_contracts.title')}</h1>

        {/* Contract Addresses */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin_contracts.contract_addresses')}</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <span className="text-sm font-medium text-gray-700">{t('admin_contracts.distribution')}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-gray-600 block md:hidden">{shortenAddress(contractsInfo.distribution.contractAddress)}</span>
                <span className="text-sm font-mono text-gray-600 hidden md:block">{contractsInfo.distribution.contractAddress}</span>
                <a
                  href={contractsInfo.distribution.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 transition"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <span className="text-sm font-medium text-gray-700">{t('admin_contracts.marketplace')}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-gray-600 block md:hidden">{shortenAddress(contractsInfo.marketplace.contractAddress)}</span>
                <span className="text-sm font-mono text-gray-600 hidden md:block">{contractsInfo.marketplace.contractAddress}</span>
                <a
                  href={contractsInfo.marketplace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 transition"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700">{t('admin_contracts.cofi_collection')}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-gray-600 block md:hidden">{shortenAddress(contractsInfo.cofiCollection.contractAddress)}</span>
                <span className="text-sm font-mono text-gray-600 hidden md:block">{contractsInfo.cofiCollection.contractAddress}</span>
                <a
                  href={contractsInfo.cofiCollection.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 transition"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700">{t('admin_contracts.swap')}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-gray-600 block md:hidden">{shortenAddress(contractsInfo.swap.contractAddress)}</span>
                <span className="text-sm font-mono text-gray-600 hidden md:block">{contractsInfo.swap.contractAddress}</span>
                <a
                  href={contractsInfo.swap.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 transition"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Marketplace Balance */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin_contracts.marketplace_balance')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-1 gap-6">
            <BalanceCard
              label={t('balances.currency_usdc')}
              amount={formatBalance(contractsInfo.marketplace.usdcBalance, PaymentToken.USDC)}
            />
          </div>
        </div>

        {/* Swap Balance */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin_contracts.swap_balance')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-1 gap-6">
            <BalanceCard
              label={t('balances.currency_usdc')}
              amount={formatBalance(contractsInfo.swap.usdcBalance, PaymentToken.USDC)}
            />
          </div>
        </div>

        {/* Distribution Statistics */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin_contracts.distribution_statistics')}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">{t('admin_contracts.total_purchases')}</span>
              <span className="text-lg font-semibold text-gray-900">
                ${formatBalance(contractsInfo.distribution.totalPurchases, PaymentToken.USDC)}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-gray-700">{t('admin_contracts.total_profit')}</span>
              <span className="text-lg font-semibold text-green-600">
                ${formatBalance(contractsInfo.distribution.totalProfit, PaymentToken.USDC)}
              </span>
            </div>
          </div>
        </div>

        {/* Distribute Button */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <button
            onClick={handleDistribute}
            disabled={distributing}
            className="
              w-full
              px-6 py-3
              bg-green-600
              text-white
              font-semibold
              rounded-lg
              hover:bg-green-700
              transition
              disabled:opacity-50
              disabled:cursor-not-allowed
              flex items-center justify-center gap-2
            "
          >
            {distributing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {t('admin_contracts.distributing')}
              </>
            ) : (
              t('admin_contracts.button_distribute')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

