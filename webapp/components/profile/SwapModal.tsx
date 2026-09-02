'use client'

import { useState, useEffect } from 'react'
import { useSwap } from '@/hooks/profile/useSwap'
import { SwapToken, PaymentToken } from '@/types/contracts'
import { onchainService } from '@/services/api/onchain'
import { formatBalance } from '@/utils/formatting'
import Modal from '@/components/ui/Modal'

interface SwapModalProps {
  isOpen: boolean
  onClose: () => void
  tokenLabel: string
  tokenBalance: string
  t: any
}

export function SwapModal({
  isOpen,
  onClose,
  tokenLabel,
  tokenBalance,
  t,
}: SwapModalProps) {
  const { handleSwap } = useSwap()
  const [usdcAmount, setUsdcAmount] = useState<string>('')
  const [requiredTokenAmount, setRequiredTokenAmount] = useState<string | null>(null)
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false)
  const [errors, setErrors] = useState<{
    usdcAmount?: string
    swap?: string
  }>({})
  const [isSwapping, setIsSwapping] = useState<boolean>(false)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)

  // Map token label to SwapToken enum
  const getSwapToken = (label: string): SwapToken => {
    const labelUpper = label?.toUpperCase() || ''
    if (labelUpper.includes('STARK')) return SwapToken.STRK
    if (labelUpper.includes('USDT')) return SwapToken.USDT
    if (labelUpper.includes('USDC.E') || labelUpper.includes('USDC_BRIDGED')) return SwapToken.USDC_BRIDGED
    return SwapToken.STRK
  }

  const selectedToken = getSwapToken(tokenLabel)
  const tokenBalanceNum = parseFloat(tokenBalance || '0.00')

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUsdcAmount('')
      setRequiredTokenAmount(null)
      setErrors({})
      setIsSwapping(false)
      setIsLoadingPrice(false)
      setSuccessTxHash(null)
    }
  }, [isOpen])

  // Fetch swap price when USDC amount changes
  useEffect(() => {
    if (!isOpen) return

    const fetchSwapPrice = async () => {
      if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
        setRequiredTokenAmount(null)
        return
      }

      setIsLoadingPrice(true)
      setErrors(prev => ({ ...prev, swap: undefined }))
      
      try {
        const price = await onchainService.getSwapPrice(selectedToken, parseFloat(usdcAmount))
        if (selectedToken === SwapToken.STRK) {
          const priceFormatted = formatBalance(price, PaymentToken.STRK)
          setRequiredTokenAmount(priceFormatted)
        } else {
          const priceFormatted = formatBalance(price, PaymentToken.USDC)
          setRequiredTokenAmount(priceFormatted)
        }
      } catch (error) {
        console.error('Error fetching swap price:', error)
        setRequiredTokenAmount(null)
        setErrors(prev => ({
          ...prev,
          swap: 'Failed to fetch swap price. Please try again.'
        }))
      } finally {
        setIsLoadingPrice(false)
      }
    }

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      fetchSwapPrice()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [selectedToken, usdcAmount, isOpen])

  const handleUsdcAmountChange = (value: string) => {
    setUsdcAmount(value)
    setErrors(prev => ({ ...prev, usdcAmount: undefined, swap: undefined }))
    setSuccessTxHash(null)

    const numValue = parseFloat(value)
    if (value && (isNaN(numValue) || numValue <= 0)) {
      setErrors(prev => ({
        ...prev,
        usdcAmount: 'Amount must be greater than 0'
      }))
    }
  }

  const handleSwapClick = async () => {
    // Validate all fields
    const newErrors: typeof errors = {}

    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      newErrors.usdcAmount = 'Please enter a valid USDC amount'
    }

    if (!requiredTokenAmount) {
      newErrors.swap = 'Please wait for the price to be calculated'
    } else {
      const requiredAmount = parseFloat(requiredTokenAmount)
      if (requiredAmount > tokenBalanceNum) {
        newErrors.swap = `Insufficient balance. You need ${requiredTokenAmount} ${tokenLabel} but only have ${tokenBalance}`
      }
    }

    setErrors(newErrors)

    // If no errors, proceed with swap
    if (Object.keys(newErrors).length === 0) {
      setIsSwapping(true)
      setErrors(prev => ({ ...prev, swap: undefined }))
      setSuccessTxHash(null)
      
      try {
        const txHash = await handleSwap(selectedToken, parseFloat(usdcAmount))
        // Reset form on success
        setUsdcAmount('')
        setRequiredTokenAmount(null)
        setErrors({})
        setSuccessTxHash(txHash || null)
      } catch (error) {
        // Display error message
        const errorMessage = error instanceof Error 
          ? error.message
          : 'Failed to swap tokens. Please try again.'
        setErrors(prev => ({ ...prev, swap: errorMessage }))
        setSuccessTxHash(null)
      } finally {
        setIsSwapping(false)
      }
    }
  }

  // Check if swap is possible
  const canSwap = 
    usdcAmount && 
    parseFloat(usdcAmount) > 0 && 
    requiredTokenAmount !== null &&
    parseFloat(requiredTokenAmount) <= tokenBalanceNum &&
    !isLoadingPrice

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('balances.modal_swap_title') ?? `Swap ${tokenLabel} for USDC`}
      buttons={[
        {
          label: t('balances.modal_button_cancel') ?? 'Cancel',
          onClick: onClose,
          variant: 'secondary',
        },
        {
          label: isSwapping 
            ? (t('balances.modal_button_processing') ?? 'Processing...')
            : (t('balances.modal_button_swap') ?? 'Swap'),
          onClick: handleSwapClick,
          variant: 'primary',
          disabled: !canSwap || isSwapping,
        },
      ]}
    >
      <div className="space-y-4">
        {/* Token Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-600">
            {t('balances.modal_token_label') ?? 'Token'}: <span className="font-semibold">{tokenLabel}</span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {t('balances.modal_available_balance') ?? 'Available'}: <span className="font-semibold">{tokenBalance}</span>
          </p>
        </div>

        {/* USDC Amount Input */}
        <div>
          <label htmlFor="usdcAmount" className="block text-sm font-medium text-gray-700 mb-2">
            {t('balances.modal_usdc_amount_label') ?? 'USDC Amount to Receive'}
          </label>
          <input
            type="number"
            id="usdcAmount"
            value={usdcAmount}
            onChange={(e) => handleUsdcAmountChange(e.target.value)}
            min="0"
            step="0.000001"
            placeholder="0.00"
            className={`block w-full px-3 py-2 border rounded-md shadow-sm
                       focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
              errors.usdcAmount ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={isSwapping}
          />
          {errors.usdcAmount && (
            <p className="mt-1 text-sm text-red-600">{errors.usdcAmount}</p>
          )}
        </div>

        {/* Required Token Amount Display */}
        {usdcAmount && parseFloat(usdcAmount) > 0 && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            {isLoadingPrice ? (
              <p className="text-sm text-blue-700">
                {t('balances.modal_calculating_price') ?? 'Calculating price...'}
              </p>
            ) : requiredTokenAmount ? (
              <div>
                <p className="text-sm text-blue-700">
                  {t('balances.modal_required_token_amount') ?? 'You will exchange'}:{' '}
                  <span className="font-semibold">{requiredTokenAmount} {tokenLabel}</span>
                </p>
                {parseFloat(requiredTokenAmount) > tokenBalanceNum && (
                  <p className="text-xs text-red-600 mt-1">
                    {t('balances.modal_insufficient_balance') ?? 'Insufficient balance'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-600">
                {t('balances.modal_price_error') ?? 'Failed to calculate price'}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {errors.swap && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-md">
            <p className="text-sm text-red-800">{errors.swap}</p>
          </div>
        )}

        {/* Success Message */}
        {successTxHash && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-md">
            <p className="text-sm text-green-800">
              {t('balances.modal_swap_success_message') ?? 'Swap successful!'}
            </p>
            <p className="text-xs text-green-600 mt-1 font-mono break-all">
              {t('balances.modal_tx_hash') ?? 'Transaction Hash'}: {successTxHash}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

