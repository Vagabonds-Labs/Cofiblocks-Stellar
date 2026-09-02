'use client'

import { onchainService } from '@/services/api/onchain'
import { SwapToken } from '@/types/contracts'
import { walletService } from '@/services/wallet/walletService'
import { useWalletLogin } from '@/hooks/auth/useWalletLogin'
import { useOptionalCavos } from '@/hooks/auth/useOptionalCavos'

export function useSwap() {
  const { cavos } = useOptionalCavos()
  const { connectWalletWithoutSignature, disconnectWallet } = useWalletLogin()
  
  const handleSwap = async (token: SwapToken, usdcAmount: number) => {
    const txs = await onchainService.swapTokenForUSDC(token, usdcAmount);

    const txHash = await walletService.executeTransactions(
      txs.map(tx => ({
        contractAddress: tx.tx.contract_address,
        entrypoint: tx.tx.entrypoint,
        calldata: tx.tx.calldata,
      })),
      connectWalletWithoutSignature,
      disconnectWallet,
      cavos
    )

    return txHash
  }

  return { handleSwap }
}
