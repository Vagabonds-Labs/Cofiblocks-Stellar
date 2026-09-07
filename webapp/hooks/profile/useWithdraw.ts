'use client'

import { onchainService } from '@/services/api/onchain'
import { PaymentToken } from '@/types/contracts'
import { walletService } from '@/services/wallet/walletService'

export function useWithdraw() {
  const handleWithdraw = async (
    token: PaymentToken, amount: number, withdrawAddress: string
  ) => {
    const prepared = await onchainService.withdraw(token, amount.toString(), withdrawAddress)
    return walletService.signTransaction(prepared)
  }

  return { handleWithdraw }
}
