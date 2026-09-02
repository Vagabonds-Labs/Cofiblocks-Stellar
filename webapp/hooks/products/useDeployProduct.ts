'use client'

import { useState, useCallback } from 'react'
import { walletService } from '@/services/wallet/walletService'
import { useWalletLogin } from '@/hooks/auth/useWalletLogin'
import { productService } from '@/services/api/products'
import { useOptionalCavos } from '@/hooks/auth/useOptionalCavos'

export function useDeployProduct({
  product,
  onSuccess,
}: {
  product: any
  onSuccess?: () => void
}) {
  const [isDeploying, setIsDeploying] = useState(false)
  const { connectWalletWithoutSignature, disconnectWallet } = useWalletLogin()
  const { cavos } = useOptionalCavos()

  const deploy = useCallback(async () => {
    if (isDeploying) return

    setIsDeploying(true)

    try {
      // 1. Ask backend for prepared transaction
      const deployResponse = await productService.deployProduct({
        initialStock: product.currentStock,
        price: product.price,
        product_id: product.id,
      })

      const tx = deployResponse.transaction

      // 2. Execute on-chain
      const txHash = await walletService.executeTransactions([
        {
          contractAddress: tx.contract_address,
          entrypoint: tx.entrypoint,
          calldata: tx.calldata,
        },
      ], connectWalletWithoutSignature, disconnectWallet, cavos)

      // wait for 5 seconds while the transaction is being processed on-chain
      await new Promise((resolve) => setTimeout(resolve, 5000))

      // 3. Notify backend
      await productService.deployCallback({
        product_id: product.id,
        tx_hash: txHash,
      })

      onSuccess?.()
    } catch (err) {
      console.error('Failed to deploy product:', err)
      throw err
    } finally {
      setIsDeploying(false)
    }
  }, [
    product,
    cavos,
    connectWalletWithoutSignature,
    disconnectWallet,
    isDeploying,
    onSuccess,
  ])

  return {
    deploy,
    isDeploying,
  }
}
