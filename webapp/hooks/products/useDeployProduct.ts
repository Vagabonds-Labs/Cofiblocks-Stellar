'use client'

import { useState, useCallback } from 'react'

import { walletService } from '@/services/wallet/walletService'
import { productService } from '@/services/api/products'

export function useDeployProduct({
  product,
  onSuccess,
}: {
  product: any
  onSuccess?: () => void
}) {
  const [isDeploying, setIsDeploying] = useState(false)

  const deploy = useCallback(async () => {
    if (isDeploying) return

    setIsDeploying(true)

    try {
      // 1. El backend arma y simula la transacción.
      const prepared = await productService.deployProduct({
        initialStock: product.currentStock,
        price: product.price,
        product_id: product.id,
      })

      // 2. La wallet la firma.
      const signedXdr = await walletService.signTransaction(prepared)

      // 3. El backend la envía con fee-bump y verifica el evento. Ya no hace
      //    falta esperar 5 segundos a ciegas: el submit hace polling.
      await productService.deployCallback({
        product_id: product.id,
        signed_xdr: signedXdr,
      })

      onSuccess?.()
    } catch (err) {
      console.error('Failed to deploy product:', err)
      throw err
    } finally {
      setIsDeploying(false)
    }
  }, [product, isDeploying, onSuccess])

  return {
    deploy,
    isDeploying,
  }
}
