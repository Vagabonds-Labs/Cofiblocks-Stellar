'use client'

import { useState } from 'react'
import { CreditCardIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { BridgeWidgetModal } from './BridgeWidgetModal'

export function FundingSection({ funding, user, t }: any) {

  const [isBridgeWidgetOpen, setIsBridgeWidgetOpen] = useState(false);

  const handleFundByBridge = () => {
    setIsBridgeWidgetOpen(true);
  }

  const handleCloseBridgeWidget = () => {
    setIsBridgeWidgetOpen(false);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      <button
        onClick={funding.handleFundByCard}
        disabled={user?.walletProvider !== 'cavos'}
        className="flex items-center justify-center gap-3 px-6 py-4 bg-orange-500 text-white rounded-lg
                   hover:bg-orange-600 transition-colors font-medium shadow-sm disabled:opacity-50"
      >
        <CreditCardIcon className="w-5 h-5" />
        {t('balances.button_fund_by_card')}
      </button>

      <button
        onClick={handleFundByBridge}
        className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-500 text-white rounded-lg
                   hover:bg-blue-600 transition-colors font-medium shadow-sm"
      >
        <ArrowPathIcon className="w-5 h-5" />
        {t('balances.button_fund_by_bridge')}
      </button>

      {isBridgeWidgetOpen && (
        <BridgeWidgetModal
          isOpen={isBridgeWidgetOpen}
          onClose={handleCloseBridgeWidget}
          recipientAddress={user?.walletAddress}
        />
      )}
    </div>
  )
}
