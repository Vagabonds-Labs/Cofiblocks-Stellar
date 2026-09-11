'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { ExclamationCircleIcon, WalletIcon } from '@heroicons/react/24/outline'
import { walletService } from '@/services/wallet/walletService'
import { onchainService } from '@/services/api/onchain'
import { useUser } from '@/lib/providers/UserProvider'

import { useCheckout } from '@/hooks'
import { CheckoutHeader, OrderItemsList, SummaryCard, DeliverySection, OrderExpirationWarning, OrderSuccess } from '@/components/checkout'
import { orderService } from '@/services/api/orders/service'
import { Order } from '@/services/api/orders/types'

export default function CheckoutPage() {
  const { orderId } = useParams()
  const router = useRouter()
  const t = useTranslations()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isOrderExpired, setIsOrderExpired] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [hasScrolledOnSuccess, setHasScrolledOnSuccess] = useState(false)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const { user } = useUser()
  // Quien entró con email o Google paga "con su saldo", no "con USDC (cripto)".
  const simple = user?.walletProvider === 'privy'

  const checkout = useCheckout(orderId as string)

  useEffect(() => {
    if (completedOrder && !hasScrolledOnSuccess) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setHasScrolledOnSuccess(true)
    }
  }, [completedOrder, hasScrolledOnSuccess])

  const handleCryptoPayment = async () => {
    setPaymentError(null)
    setInsufficientBalance(false)
    setIsProcessing(true)
    try {
      // Antes de armar nada, ver si el saldo alcanza. Si no, el contrato
      // fallaría con un error técnico; mejor decirlo claro y mandar a recargar.
      try {
        const { balances } = await onchainService.getBalanceOf()
        const available = Number(balances.USDC)
        if (Number.isFinite(available) && available < checkout.totalPrice) {
          setPaymentError(
            t('checkout.insufficient_balance', {
              balance: `$${available.toFixed(2)}`,
              total: `$${checkout.totalPrice.toFixed(2)}`,
            })
          )
          setInsufficientBalance(true)
          return
        }
      } catch (err) {
        // Si no se pudo consultar, seguimos: el backend valida igual.
        console.warn('Could not pre-check balance', err)
      }

      // Una sola transacción: el backend ya la armó y simuló entera.
      const prepared = await checkout.handleCheckout()
      if (prepared) {
        try {
          const signedXdr = await walletService.signTransaction(prepared)

          // El backend la envía con fee-bump y espera la confirmación, así el
          // comprador no necesita XLM ni hay que adivinar cuánto tarda.
          const order = await orderService.checkoutOrderCallback({
            id: orderId as string,
            signed_xdr: signedXdr,
          })

          // Order completed successfully
          setCompletedOrder(order)

        } catch (walletError) {
          const errorMessage = walletError instanceof Error 
            ? walletError.message 
            : 'Failed to execute payment transaction'
          setPaymentError(errorMessage)
          throw walletError
        }
      }
    } catch (error) {
      // Checkout errors are handled in the hook and displayed via checkout.checkoutError
      // Wallet transaction errors are handled above and displayed via paymentError
      if (!checkout.checkoutError) {
        // Only set payment error if there's no checkout error (to avoid duplicate messages)
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred during checkout'
        setPaymentError(errorMessage)
      }
      console.error('Checkout error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (checkout.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">{t('checkout.loading')}</p>
      </div>
    )
  }
  if (checkout.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-red-600">{checkout.error}</p>
        </div>
      </div>
    )
  }

  // Show success component if order was completed
  if (completedOrder) {
    return (
      <OrderSuccess
        order={completedOrder}
        t={t}
        onOk={() => router.push('/')}
      />
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">

      <CheckoutHeader
        onBack={() => router.back()}
        title={t('checkout.button_back')}
      />

      <OrderExpirationWarning 
        expiresAt={checkout.order?.expiresAt} 
        onExpirationChange={setIsOrderExpired}
      />

      <OrderItemsList
        orderItems={checkout.orderItems}
        t={t}
      />

      <DeliverySection
        checkout={checkout}
        t={t}
        isProcessingPayment={isProcessing || checkout.checkoutLoading}
      />

      <SummaryCard
        subtotal={checkout.subtotal}
        totalItems={checkout.totalItems}
        deliveryPrice={checkout.deliveryPrice}
        totalPrice={checkout.totalPrice}
        t={t}
      />

      {/* Checkout Error */}
      {(checkout.checkoutError || paymentError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">
              {checkout.checkoutError || paymentError}
            </p>
            {insufficientBalance && (
              <button
                onClick={() => router.push('/profile')}
                className="mt-2 text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                {t('checkout.go_to_profile')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <button
          onClick={handleCryptoPayment}
          disabled={
            checkout.checkoutLoading || 
            isProcessing || 
            isOrderExpired ||
            (checkout.deliveryOption === 'delivery' && !checkout.isDeliveryFormSaved) ||
            (checkout.deliveryOption === 'pickup' && !checkout.selectedEventId)
          }
          className={`w-full md:flex-[2] py-2.5 rounded-lg text-base font-semibold transition-colors flex items-center justify-center gap-2 ${
            checkout.checkoutLoading || 
            isProcessing || 
            isOrderExpired ||
            (checkout.deliveryOption === 'delivery' && !checkout.isDeliveryFormSaved) ||
            (checkout.deliveryOption === 'pickup' && !checkout.selectedEventId)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-700'
          } text-white`}
        >
          {checkout.checkoutLoading || isProcessing ? (
            t('checkout.processing')
          ) : (
            <>
              <WalletIcon className="w-4 h-4" />
              {simple ? t('checkout.button_pay_balance') : t('checkout.button_pay_crypto')}
            </>
          )}
        </button>

      </div>
    </main>
  )
}
