'use client'

import { ArrowPathIcon, WalletIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { formatAddressForClipboard } from '@/utils/formatting'
import { BalanceCard } from './BalanceCard'
import { TransferModal } from './TransferModal'
import { SwapModal } from './SwapModal'

/**
 * Shortens a wallet address for display purposes only.
 * Copy action always uses the full address.
 */
function shortenAddress(address: string, chars = 12) {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function BalancesSection({ balances, user, t }: any) {
  const [copied, setCopied] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [selectedTokenForTransfer, setSelectedTokenForTransfer] = useState<{
    label: string
    balance: string
  } | null>(null)
  const [swapModalOpen, setSwapModalOpen] = useState(false)
  const [selectedTokenForSwap, setSelectedTokenForSwap] = useState<{
    label: string
    balance: string
  } | null>(null)

  const handleCopy = async () => {
    if (!user?.walletAddress) return
    await navigator.clipboard.writeText(
      formatAddressForClipboard(user.walletAddress)
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Handle transfer action - open modal
  const handleTransfer = (tokenLabel: string) => {
    // Get the balance for this token
    const labelUpper = tokenLabel?.toUpperCase() || ''
    let balance = '0.00'
    if (labelUpper.includes('STARK')) {
      balance = balances.balances.starks
    } else if (labelUpper.includes('USDT')) {
      balance = balances.balances.usdt
    } else if (labelUpper.includes('USDC.E') || labelUpper.includes('USDC_BRIDGED')) {
      balance = balances.balances.usdc_bridged
    } else if (labelUpper.includes('USDC')) {
      balance = balances.balances.usdc
    }

    setSelectedTokenForTransfer({ label: tokenLabel, balance })
    setTransferModalOpen(true)
  }

  // Handle swap action - open modal
  const handleSwap = (tokenLabel: string) => {
    // Get the balance for this token
    const labelUpper = tokenLabel?.toUpperCase() || ''
    let balance = '0.00'
    if (labelUpper.includes('STARK')) {
      balance = balances.balances.starks
    } else if (labelUpper.includes('USDT')) {
      balance = balances.balances.usdt
    } else if (labelUpper.includes('USDC.E') || labelUpper.includes('USDC_BRIDGED')) {
      balance = balances.balances.usdc_bridged
    }

    setSelectedTokenForSwap({ label: tokenLabel, balance })
    setSwapModalOpen(true)
  }

  return (
    <div className="mt-10 flex flex-col items-center gap-12 text-center">
      {/* Wallet address */}
      <div className="flex flex-col items-center gap-3">
        {/* Icon + label */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <WalletIcon className="w-5 h-5 text-amber-600" />
          </div>

          <p className="text-sm text-gray-500">
            {t('balances.wallet_address_label') ?? 'Your wallet address'}
          </p>
        </div>

        {user?.walletAddress ? (
          <button
            onClick={handleCopy}
            className="
              group relative
              px-4 py-2
              rounded-xl
              bg-amber-50
              font-mono
              text-sm md:text-base
              text-gray-900
              hover:bg-amber-100
              hover:text-orange-600
              transition
              max-w-full
            "
            title={user.walletAddress}
          >
            {/* Mobile: shortened | Desktop: full */}
            <span className="block md:hidden">
              {shortenAddress(user.walletAddress)}
            </span>
            <span className="hidden md:block">
              {user.walletAddress}
            </span>

            {/* Copy feedback */}
            <span
              className="
                absolute left-1/2 -bottom-5 -translate-x-1/2
                text-xs text-orange-500
                opacity-0 group-hover:opacity-100
                transition
              "
            >
              {copied ? t('balances.copied') ?? 'Copied' : ''}
            </span>
          </button>
        ) : (
          <p className="text-sm text-gray-400">
            {t('balances.no_wallet_address')}
          </p>
        )}

        {user?.walletAddress && user.walletProvider === 'cavos' && (
          <p className="text-xs text-gray-500 max-w-md mt-2">
            {t('balances.disclaimer_message')}
          </p>
        )}
      </div>

      {/* Balances */}
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-medium text-gray-500">
            {t('balances.label_balance')}
          </span>

          <button
            onClick={balances.fetchBalances}
            disabled={balances.loadingBalances || !user?.walletAddress}
            className="
              flex items-center gap-2
              text-sm text-gray-500
              hover:text-gray-800
              transition
              disabled:opacity-50
            "
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${
                balances.loadingBalances ? 'animate-spin' : ''
              }`}
            />
            {t('balances.refresh')}
          </button>
        </div>

        {/* Main USDC Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-1 gap-6 mb-8">
          <BalanceCard
            label={t('balances.currency_usdc')}
            amount={balances.balances.usdc}
            color="blue"
            showMenu={true}
            onTransfer={() => handleTransfer(t('balances.currency_usdc'))}
            t={t}
          />
        </div>

        {/* Other Tokens Section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-500 mb-4">
            {t('balances.other_tokens')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <BalanceCard
              label={t('balances.currency_usdc_bridged')}
              amount={balances.balances.usdc_bridged}
              color="blue"
              showMenu={true}
              onTransfer={() => handleTransfer(t('balances.currency_usdc_bridged'))}
              onSwap={() => handleSwap(t('balances.currency_usdc_bridged'))}
              t={t}
            />
            <BalanceCard
              label={t('balances.currency_starks')}
              amount={balances.balances.starks}
              color="orange"
              showMenu={true}
              onTransfer={() => handleTransfer(t('balances.currency_starks'))}
              onSwap={() => handleSwap(t('balances.currency_starks'))}
              t={t}
            />
            <BalanceCard
              label={t('balances.currency_usdt')}
              amount={balances.balances.usdt}
              color="emerald"
              showMenu={true}
              onTransfer={() => handleTransfer(t('balances.currency_usdt'))}
              onSwap={() => handleSwap(t('balances.currency_usdt'))}
              t={t}
            />
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {selectedTokenForTransfer && (
        <TransferModal
          isOpen={transferModalOpen}
          onClose={() => {
            setTransferModalOpen(false)
            setSelectedTokenForTransfer(null)
          }}
          tokenLabel={selectedTokenForTransfer.label}
          tokenBalance={selectedTokenForTransfer.balance}
          userWalletAddress={user?.walletAddress ?? ''}
          t={t}
        />
      )}

      {/* Swap Modal */}
      {selectedTokenForSwap && (
        <SwapModal
          isOpen={swapModalOpen}
          onClose={() => {
            setSwapModalOpen(false)
            setSelectedTokenForSwap(null)
          }}
          tokenLabel={selectedTokenForSwap.label}
          tokenBalance={selectedTokenForSwap.balance}
          t={t}
        />
      )}
    </div>
  )
}
