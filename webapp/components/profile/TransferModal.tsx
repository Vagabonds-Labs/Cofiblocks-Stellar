'use client'

import { useState, useEffect } from 'react'
import { useWithdraw } from '@/hooks/profile/useWithdraw'
import { PaymentToken } from '@/types/contracts'
import Modal from '@/components/ui/Modal'

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  tokenLabel: string
  tokenBalance: string
  userWalletAddress: string
  t: any
}

export function TransferModal({
  isOpen,
  onClose,
  tokenLabel,
  tokenBalance,
  userWalletAddress,
  t,
}: TransferModalProps) {
  const { handleWithdraw } = useWithdraw()
  const [amount, setAmount] = useState<string>('')
  const [address, setAddress] = useState<string>('')
  const [errors, setErrors] = useState<{
    amount?: string
    address?: string
    withdraw?: string
  }>({})
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)

  // Sólo quedan XLM y USDC.
  const getPaymentToken = (label: string): PaymentToken => {
    const labelUpper = label?.toUpperCase() || ''
    if (labelUpper.includes('XLM') || labelUpper.includes('LUMEN')) return PaymentToken.XLM
    return PaymentToken.USDC
  }

  const selectedToken = getPaymentToken(tokenLabel)
  const maxAmount = parseFloat(tokenBalance || '0.00')

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount('')
      setAddress('')
      setErrors({})
      setIsWithdrawing(false)
      setSuccessTxHash(null)
    }
  }, [isOpen])

  const validateAddress = (addr: string): boolean => {
    // Cuenta clásica de Stellar: StrKey `G` + 55 caracteres base32.
    // Las cuentas contrato (`C…`) no se soportan en v1.
    return /^G[A-Z2-7]{55}$/.test(addr)
  }

  const handleAmountChange = (value: string) => {
    setAmount(value)
    setErrors(prev => ({ ...prev, amount: undefined }))
    setSuccessTxHash(null)

    const numValue = parseFloat(value)
    if (value && (isNaN(numValue) || numValue < 0 || numValue > maxAmount)) {
      setErrors(prev => ({
        ...prev,
        amount: `Amount must be between 0 and ${maxAmount}`
      }))
    }
  }

  const handleAddressChange = (value: string) => {
    setAddress(value)
    setErrors(prev => ({ ...prev, address: undefined }))
    setSuccessTxHash(null)

    if (value && !validateAddress(value)) {
      setErrors(prev => ({
        ...prev,
        address: 'Enter a valid Stellar account (G…)'
      }))
    } else if (value && value.toLowerCase() === userWalletAddress.toLowerCase()) {
      setErrors(prev => ({
        ...prev,
        address: 'You cannot send tokens to your own address'
      }))
    }
  }

  const handleWithdrawClick = async () => {
    // Validate all fields
    const newErrors: typeof errors = {}

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount'
    } else {
      const numValue = parseFloat(amount)
      if (numValue > maxAmount) {
        newErrors.amount = `Amount cannot exceed ${maxAmount}`
      }
    }

    if (!address) {
      newErrors.address = 'Please enter a wallet address'
    } else if (!validateAddress(address)) {
      newErrors.address = 'Enter a valid Stellar account (G…)'
    } else if (address === userWalletAddress) {
      newErrors.address = 'You cannot send tokens to your own address'
    }

    setErrors(newErrors)

    // If no errors, proceed with withdrawal
    if (Object.keys(newErrors).length === 0) {
      setIsWithdrawing(true)
      setErrors(prev => ({ ...prev, withdraw: undefined }))
      setSuccessTxHash(null)
      
      try {
        const txHash = await handleWithdraw(selectedToken, parseFloat(amount), address)
        // Reset form on success
        setAmount('')
        setAddress('')
        setErrors({})
        setSuccessTxHash(txHash || null)
      } catch (error) {
        // Display error message
        const errorMessage = error instanceof Error 
          ? error.message
          : 'Failed to withdraw tokens. Please try again.'
        setErrors(prev => ({ ...prev, withdraw: errorMessage }))
        setSuccessTxHash(null)
      } finally {
        setIsWithdrawing(false)
      }
    }
  }

  const isFormValid = 
    amount && 
    parseFloat(amount) > 0 && 
    parseFloat(amount) <= maxAmount &&
    address &&
    validateAddress(address) &&
    address !== userWalletAddress

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('balances.modal_transfer_title') ?? `Transfer ${tokenLabel}`}
      buttons={[
        {
          label: t('balances.modal_button_cancel') ?? 'Cancel',
          onClick: onClose,
          variant: 'secondary',
        },
        {
          label: isWithdrawing 
            ? (t('balances.modal_button_processing') ?? 'Processing...')
            : (t('balances.modal_button_withdraw') ?? 'Withdraw'),
          onClick: handleWithdrawClick,
          variant: 'primary',
          disabled: !isFormValid || isWithdrawing,
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

        {/* Amount Input */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
            {t('balances.modal_amount_label') ?? 'Amount'}
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            min="0"
            max={maxAmount}
            step="0.000001"
            placeholder={`0 - ${maxAmount}`}
            className={`block w-full px-3 py-2 border rounded-md shadow-sm
                       focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
              errors.amount ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={isWithdrawing}
          />
          {errors.amount && (
            <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
          )}
        </div>

        {/* Address Input */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
            {t('balances.modal_address_label') ?? 'Wallet Address'}
          </label>
          <input
            type="text"
            id="address"
            value={address}
            onChange={(e) => handleAddressChange(e.target.value)}
            placeholder="G..."
            className={`block w-full px-3 py-2 border rounded-md shadow-sm font-mono text-sm
                       focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
              errors.address ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={isWithdrawing}
          />
          {errors.address && (
            <p className="mt-1 text-sm text-red-600">{errors.address}</p>
          )}
        </div>

        {/* Error Message */}
        {errors.withdraw && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-md">
            <p className="text-sm text-red-800">{errors.withdraw}</p>
          </div>
        )}

        {/* Success Message */}
        {successTxHash && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-md">
            <p className="text-sm text-green-800">
              {t('balances.modal_success_message') ?? 'Transfer successful!'}
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

