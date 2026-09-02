
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

import { useCart } from '@/lib/stores/cartStore';
import { useCartProducts } from './useCartProducts';
import { usePendingCheckout } from './usePendingCheckout';
import { authService } from '@/services/auth/authService';
import { orderService } from '@/services/api/orders';
import { ApiError } from '@/lib/api/types';
import { useTranslations } from 'next-intl';

export function useCartDropdownLogic(locale: string) {
    const router = useRouter()
    const items = useCart(s => s.items)
    const t = useTranslations()
    const clearCart = useCart(s => s.clearCart)
    const [showCart, setShowCart] = useState(false)
    const [checkoutLoading, setCheckoutLoading] = useState(false)
    const [checkoutError, setCheckoutError] = useState<string | null>(null)
  
    const { products, loading } = useCartProducts(showCart, items)
  
    const handleCheckout = useCallback(async () => {
        if (checkoutLoading || items.length === 0) return
    
        // Clear previous error when starting a new checkout attempt
        setCheckoutError(null)

        if (!authService.isAuthenticated()) {
          setShowCart(false)
          sessionStorage.setItem('pendingCheckout', 'true')
          sessionStorage.setItem('checkoutRedirect', 'true')
          router.push(`/${locale}/login?redirect=checkout`)
          return
        }
    
        setCheckoutLoading(true)
        try {
          const orderData = {
            products: items
              .filter(i => products.has(i.productId))
              .map(i => ({ id: i.productId, amount: i.amount }))
          }
    
          const created = await orderService.createOrder(orderData)
          const orderId = created.order_id
    
          await orderService.getOrderItems(orderId)
    
          clearCart()
          setShowCart(false)
          setCheckoutLoading(false)
          router.push(`/${locale}/checkout/${orderId}`)
        } catch (err) {
          // Surface a non-blocking error so the UI can render it above the button
          const apiError = err as ApiError
          setCheckoutError(t(`api_errors.${apiError.code}`))
          setCheckoutLoading(false)
        }
      }, [checkoutLoading, items, products, locale, router, clearCart, setShowCart])
  
    usePendingCheckout(items.length, handleCheckout)
  
    return {
      items,
      clearCart,
      showCart,
      setShowCart,
      checkoutLoading,
      products,
      loading,
      handleCheckout,
      checkoutError,
    }
  }
  