'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSells } from './useSells'
import { Order } from '@/services/api/orders'
import { useUser } from '@/lib/providers/UserProvider'
import { sellsService } from '@/services/api/sells'
import { useWalletLogin } from '@/hooks/auth/useWalletLogin'
import { walletService } from '@/services/wallet/walletService'
import { useTranslations } from 'next-intl'
import { useOptionalCavos } from '@/hooks/auth/useOptionalCavos'

export type FilterType = 'pending' | 'completed' | 'claims'

export interface PendingClaim {
  orderId: string
  productTitle: string
  items: number
  producerClaimBalance: number
}

export function useMySales() {
  const t = useTranslations()
  const { user } = useUser()
  const { orders, loading, error, refetch } = useSells()
  const { connectWalletWithoutSignature, disconnectWallet } = useWalletLogin()
  const { cavos } = useOptionalCavos()
  const [activeFilter, setActiveFilter] = useState<FilterType>('pending')
  const [contractClaimBalance, setContractClaimBalance] = useState<string | null>(null)
  const [loadingContractBalance, setLoadingContractBalance] = useState(false)
  const [claimingMoney, setClaimingMoney] = useState(false)
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null)

  // Categorize orders
  const { pendingDelivery, completed } = useMemo(() => {
    const pending: Order[] = []
    const completed: Order[] = []

    orders.forEach((order) => {
      // Check if order has any orderItems with delivered=false
      const hasPendingItems = order.orderItems.some(item => !item.delivered)
      
      if (hasPendingItems) {
        pending.push(order)
      } else {
        completed.push(order)
      }
    })

    return {
      pendingDelivery: pending,
      completed: completed
    }
  }, [orders])

  // Get pending claims
  const pendingClaims = useMemo(() => {
    const claims: PendingClaim[] = []

    orders.forEach((order) => {
      order.orderItems.forEach((item) => {
        if (item.producerClaimBalance > 0) {
          claims.push({
            orderId: order.id,
            productTitle: item.product.title,
            items: item.items,
            producerClaimBalance: item.producerClaimBalance,
          })
        }
      })
    })

    return claims
  }, [orders])

  const totalClaimBalance = useMemo(() => {
    return pendingClaims.reduce((sum, claim) => sum + claim.producerClaimBalance, 0)
  }, [pendingClaims])

  const claimMoneyFromContract = useCallback(async () => {
    setClaimingMoney(true)
    setClaimSuccessMessage(null)
    
    try {
      const tx = await sellsService.getClaimTx()
      const txHash = await walletService.executeTransactions([{
        contractAddress: tx.tx.contract_address,
        entrypoint: tx.tx.entrypoint,
        calldata: tx.tx.calldata,
      }], connectWalletWithoutSignature, disconnectWallet, cavos)
      console.log('txHash', txHash)

      // wait for the tx to be mined in 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000))

      await sellsService.claimCallback(txHash)
      
      // Refresh orders data to update claim balances
      await refetch()
      
      // Refresh contract claim balance
      if (user?.walletAddress) {
        const balance = await sellsService.getClaimBalance()
        setContractClaimBalance(balance)
      }
      
      setClaimSuccessMessage(t('my_sales.claim_success'))
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setClaimSuccessMessage(null)
      }, 5000)
    } catch (err) {
      console.error('Failed to claim money from contract:', err)
      throw err
    } finally {
      setClaimingMoney(false)
    }
  }, [refetch, user?.walletAddress, connectWalletWithoutSignature, disconnectWallet, cavos])

  // Always fetch contract claim balance when user has wallet address
  useEffect(() => {
    if (user?.walletAddress) {
      setLoadingContractBalance(true)
      sellsService.getClaimBalance()
        .then((balance) => {
          setContractClaimBalance(balance)
        })
        .catch((err) => {
          console.error('Failed to fetch contract claim balance:', err)
          setContractClaimBalance(null)
        })
        .finally(() => {
          setLoadingContractBalance(false)
        })
    }
  }, [user?.walletAddress])

  return {
    orders,
    loading,
    error,
    activeFilter,
    setActiveFilter,
    pendingDelivery,
    completed,
    pendingClaims,
    totalClaimBalance,
    contractClaimBalance,
    loadingContractBalance,
    claimMoneyFromContract,
    claimingMoney,
    claimSuccessMessage
  }
}
