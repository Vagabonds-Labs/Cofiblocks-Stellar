'use client'

import { useTranslations } from 'next-intl'
import { BanknotesIcon } from '@heroicons/react/24/outline'
import { formatBalance } from '@/utils/formatting'
import { PaymentToken } from '@/types/contracts'
import { PendingClaim } from '@/hooks/sells/useMySales'

interface PendingClaimsProps {
  claims: PendingClaim[]
  totalClaimBalance: number
  contractClaimBalance: string | null
  loadingContractBalance: boolean
  claimMoneyFromContract: () => Promise<void>
  claimingMoney: boolean
  claimSuccessMessage: string | null
}

export function PendingClaims({
  claims,
  totalClaimBalance,
  contractClaimBalance,
  loadingContractBalance,
  claimMoneyFromContract,
  claimingMoney,
  claimSuccessMessage,
}: PendingClaimsProps) {
  const t = useTranslations()

  // Calculate contract balance as number for comparison
  const contractBalanceNumber = contractClaimBalance !== null 
    ? parseFloat(formatBalance(contractClaimBalance, PaymentToken.USDC))
    : 0

  // Check if amounts are different (with small tolerance for floating point comparison)
  const amountsDiffer = Math.abs(totalClaimBalance - contractBalanceNumber) > 0.01

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <BanknotesIcon className="w-6 h-6 text-green-600" />
        <h2 className="text-2xl font-semibold text-gray-900">
          {t('my_sales.pending_claims')}
        </h2>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
          {claims.length}
        </span>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('my_sales.order_id')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('my_sales.product')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('my_sales.items')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('my_sales.claim_balance')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    {t('my_sales.no_pending_claims')}
                  </td>
                </tr>
              ) : (
                claims.map((claim, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {claim.orderId.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {claim.productTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {claim.items}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD'
                      }).format(claim.producerClaimBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Only show total claim balance if amounts differ */}
          {amountsDiffer && (
            <div className="flex justify-between items-center">
              <h3 className="text-l font-semibold text-gray-900">{t('my_sales.total_claim_balance')}</h3>
              <p className="text-2xl font-bold text-green-600">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(totalClaimBalance)}
              </p>
            </div>
          )}
          
          <div className={`flex justify-between items-center ${amountsDiffer ? 'pt-4 border-t border-gray-200' : ''}`}>
            <h3 className="text-lg font-semibold text-gray-900">{t('my_sales.contract_claim_balance')}</h3>
            <p className="text-2xl font-bold text-blue-600">
              {loadingContractBalance ? (
                <span className="text-sm text-gray-500">{t('my_sales.loading')}</span>
              ) : contractClaimBalance !== null ? (
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(contractBalanceNumber)
              ) : (
                <span className="text-sm text-gray-500">{t('my_sales.error_loading_balance')}</span>
              )}
            </p>
          </div>

          {/* Only show disclaimer if amounts differ */}
          {amountsDiffer && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                {t('my_sales.claim_balance_warning')}
              </p>
            </div>
          )}
        </div>

        {claimSuccessMessage && (
          <div className="mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            <p className="text-sm font-medium">{claimSuccessMessage}</p>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => claimMoneyFromContract()}
            disabled={claimingMoney || contractBalanceNumber === 0}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {claimingMoney ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{t('my_sales.claiming')}</span>
              </>
            ) : (
              <span>{t('my_sales.claim')}</span>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

