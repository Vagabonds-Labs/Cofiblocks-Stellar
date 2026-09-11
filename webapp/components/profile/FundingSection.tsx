'use client'

import { useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { BridgeWidgetModal } from './BridgeWidgetModal'

export function FundingSection({ user, t }: any) {
  const [isBridgeWidgetOpen, setIsBridgeWidgetOpen] = useState(false)

  const handleFundByBridge = () => {
    setIsBridgeWidgetOpen(true)
  }

  const handleCloseBridgeWidget = () => {
    setIsBridgeWidgetOpen(false)
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <button
        onClick={handleFundByBridge}
        disabled={!user?.walletAddress}
        className="btn-secondary flex items-center justify-center gap-3 text-sm"
      >
        <ArrowPathIcon className="h-5 w-5" />
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
