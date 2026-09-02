'use client'

import { onchainService } from '@/services/api/onchain'
import { PaymentToken } from '@/types/contracts'
import { walletService } from '@/services/wallet/walletService'
import { useWalletLogin } from '@/hooks/auth/useWalletLogin'
import { useOptionalCavos } from '@/hooks/auth/useOptionalCavos'

export function useWithdraw() {
  const { cavos } = useOptionalCavos()
  const { connectWalletWithoutSignature, disconnectWallet } = useWalletLogin()
  
  const handleWithdraw = async (token: PaymentToken | 'USDC_BRIDGED', amount: number, withdrawAddress: string) => {
    const tx = await onchainService.withdraw(token, amount.toString(), withdrawAddress);

    const txHash = await walletService.executeTransactions([{
      contractAddress: tx.tx.contract_address,
      entrypoint: tx.tx.entrypoint,
      calldata: tx.tx.calldata,
    }], connectWalletWithoutSignature, disconnectWallet, cavos)

    return txHash
  }

  return { handleWithdraw }
}
