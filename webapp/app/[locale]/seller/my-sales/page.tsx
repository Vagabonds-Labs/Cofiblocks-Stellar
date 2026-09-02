'use client'

import { useTranslations } from 'next-intl'
import { useUser } from '@/lib/providers/UserProvider'
import { useMySales } from '@/hooks/sells/useMySales'
import { SalesTabs } from '@/components/sales/SalesTabs'
import { PendingDeliveryOrders } from '@/components/sales/PendingDeliveryOrders'
import { CompletedOrders } from '@/components/sales/CompletedOrders'
import { PendingClaims } from '@/components/sales/PendingClaims'

export default function MySalesPage() {
  const t = useTranslations()
  const { loading: userLoading } = useUser()
  const {
    loading,
    error,
    activeFilter,
    setActiveFilter,
    pendingDelivery,
    completed,
    pendingClaims,
    totalClaimBalance,
    contractClaimBalance,
    loadingContractBalance,
    claimMoneyFromContract,
    claimingMoney,
    claimSuccessMessage,
  } = useMySales()

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('my_orders.loading')}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('my_sales.title')}</h1>

        <SalesTabs
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          pendingCount={pendingDelivery.length}
          completedCount={completed.length}
          claimsCount={pendingClaims.length}
        />

        {activeFilter === 'claims' && (
          <PendingClaims
            claims={pendingClaims}
            totalClaimBalance={totalClaimBalance}
            contractClaimBalance={contractClaimBalance}
            loadingContractBalance={loadingContractBalance}
            claimMoneyFromContract={claimMoneyFromContract}
            claimingMoney={claimingMoney}
            claimSuccessMessage={claimSuccessMessage}
          />
        )}

        {activeFilter === 'pending' && (
          <PendingDeliveryOrders orders={pendingDelivery} />
        )}

        {activeFilter === 'completed' && (
          <CompletedOrders orders={completed} />
        )}
      </main>
    </div>
  )
}

