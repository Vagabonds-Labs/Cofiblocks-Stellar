import { useState, useEffect } from 'react'
import { productService, Product } from '@/services/api/products'
import { walletService } from '@/services/wallet/walletService'
import { useWalletLogin } from '@/hooks/auth/useWalletLogin'
import { useOptionalCavos } from '@/hooks/auth/useOptionalCavos'

interface UseEditProductStockProps {
  product: Product
  productId: string
  onStockUpdate?: (product: Product) => void
  t: (key: string) => string
}

export function useEditProductStock({
  product,
  productId,
  onStockUpdate,
  t,
}: UseEditProductStockProps) {
  const [stockValue, setStockValue] = useState<number>(product.currentStock)
  const { cavos } = useOptionalCavos()
  const { connectWalletWithoutSignature, disconnectWallet } = useWalletLogin()
  const [isUpdatingStock, setIsUpdatingStock] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSuccess, setShowSuccess] = useState(false)

  const isBlocked = product.status === 'PUBLISHED'

  // Sync stock value when product changes
  useEffect(() => {
    setStockValue(product.currentStock)
  }, [product.currentStock])

  const handleStockDecrease = () => {
    if (stockValue > 0) {
      setStockValue(stockValue - 1)
      setShowSuccess(false)
    }
  }

  const handleStockIncrease = () => {
    setStockValue(stockValue + 1)
    setShowSuccess(false)
  }

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Block if product is not hidden
    if (isBlocked) {
      return
    }
    
    if (stockValue < 0) {
      setErrors({
        stock: t('my_products.edit.error_stock_invalid')
      })
      return
    }

    setIsUpdatingStock(true)
    setErrors({})
    setShowSuccess(false)

    try {
      const { tx } = await productService.updateStock(productId, stockValue)

      if (tx) {
        await walletService.executeTransactions([{
          contractAddress: tx.contract_address,
          entrypoint: tx.entrypoint,
          calldata: tx.calldata,
        }], connectWalletWithoutSignature, disconnectWallet, cavos)

        // wait for transaction to be confirmed for 4 seconds
        await new Promise(resolve => setTimeout(resolve, 4000))

        await productService.updateStockSync(productId)
      }
      // Refresh product data to get updated stock
      const productData = await productService.getProductById(productId)
      
      // Update local state
      setStockValue(productData.currentStock)
      
      // Notify parent of update if callback provided
      if (onStockUpdate) {
        onStockUpdate(productData)
      }

      // Show success message
      setShowSuccess(true)
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false)
      }, 5000)
    } catch (error) {
      console.error('Failed to update stock:', error)
      setErrors({
        stock: error instanceof Error ? error.message : t('my_products.edit.error_stock_update'),
      })
      setShowSuccess(false)
    } finally {
      setIsUpdatingStock(false)
    }
  }

  return {
    stockValue,
    isUpdatingStock,
    errors,
    showSuccess,
    isBlocked,
    handleStockDecrease,
    handleStockIncrease,
    handleStockUpdate,
  }
}
