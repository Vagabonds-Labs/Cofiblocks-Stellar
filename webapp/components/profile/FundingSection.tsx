'use client'

import { useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
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
    <div className="grid grid-cols-1 gap-4">

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
