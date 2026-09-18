'use client'

import { useRef, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCartIcon } from '@heroicons/react/24/outline'

import { CartItemComponent } from './CartItemComponent'
import { CartDropdownProps } from './types'
import { usePendingCheckout, useCartDropdownLogic, useOutsideClick } from '../../hooks'
import { orderService } from '@/services/api/orders'
import { Order } from '@/services/api/orders/types'

export function CartDropdown({ textColor, progress, bottom }: CartDropdownProps) {
  const t = useTranslations()
  const locale = useParams().locale as string

  const cartRef = useRef<HTMLDivElement>(null)
  const [latestOrder, setLatestOrder] = useState<Order | null>(null)
  const [latestOrderLoading, setLatestOrderLoading] = useState(false)

  const {
    items,
    showCart,
    setShowCart,
    checkoutLoading,
    checkoutError,
    products,
    loading,
    handleCheckout,
  } = useCartDropdownLogic(locale)

  usePendingCheckout(items.length, handleCheckout)

  // close dropdown on outside click
  useOutsideClick(cartRef, () => setShowCart(false))

  // Fetch latest order when cart is shown
  useEffect(() => {
    if (showCart) {
      setLatestOrderLoading(true)
      orderService.getLatestOrder()
        .then(order => {
          console.log('latest order', order)
          setLatestOrder(order)
          setLatestOrderLoading(false)
        })
        .catch(() => {
          // If no order found or error, set to null
          console.log('error getting latest order')
          setLatestOrder(null)
          setLatestOrderLoading(false)
        })
    } else {
      // Reset when cart is closed
      setLatestOrder(null)
    }
  }, [showCart])

  const validItems = items.filter(i => products.has(i.productId))
  const totalPrice = validItems.reduce((sum, i) => {
    const p = products.get(i.productId)!
    return sum + p.price * i.amount
  }, 0)

  return (
    <div className="relative" ref={cartRef}>
      <button
        onClick={() => setShowCart(!showCart)}
        aria-label={t('cart.title')}
        aria-expanded={showCart}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl hover:bg-[rgba(40,107,86,0.12)] transition-colors"
        style={{ color: textColor }}
      >
        <ShoppingCartIcon className="w-6 h-6" />
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </button>

      {showCart && (
        <div
          className="fixed left-1/2 top-[5.25rem] -translate-x-1/2 w-[calc(100vw-1.5rem)] max-w-[24rem] rounded-2xl shadow-[0_18px_42px_rgba(12,35,26,0.18)] border border-white/60 z-50 bg-white/95 backdrop-blur-xl md:absolute md:left-auto md:top-auto md:translate-x-0 md:right-0 md:mt-2 md:w-96 md:max-w-none"
          style={{ background: `rgba(${bottom},${bottom},${bottom},0.96)` }}
        >
          {/* Header */}
          <div className="p-3 border-b border-[rgba(211,220,214,0.9)]">
            <h3 className="text-sm font-semibold" style={{ color: textColor }}>
              {t('cart.title')}
            </h3>
          </div>

          {/* Items */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center" style={{ color: textColor }}>
                {t('cart.loading')}
              </p>
            ) : validItems.length === 0 ? (
              <p className="p-4 text-center" style={{ color: textColor }}>
                {t('cart.empty')}
              </p>
            ) : (
              validItems.map((item) => (
                <CartItemComponent
                  key={item.productId}
                  cartItem={item}
                  product={products.get(item.productId)!}
                  textColor={textColor}
                  progress={progress}
                />
              ))
            )}
          </div>

          {latestOrder && !latestOrderLoading && validItems.length == 0 && (
            <div className="p-3 border-b border-[rgba(211,220,214,0.9)]">
              <p className="text-sm" style={{ color: textColor }}>
                {t('cart.pending_order_message')}{' '}
                <Link
                  href={`/${locale}/checkout/${latestOrder.id}`}
                  onClick={() => setShowCart(false)}
                  className="text-[rgb(40,107,86)] hover:text-[rgb(25,82,64)] underline"
                >
                  {t('cart.continue_to_payment')}
                </Link>
              </p>
            </div>
          )}

          {/* Footer */}
          {validItems.length > 0 && (
            <div className="p-3 border-t border-[rgba(211,220,214,0.9)]">
              <div className="flex justify-between mb-2">
                <span className="font-semibold" style={{ color: textColor }}>
                  {t('cart.total')}
                </span>
                <strong style={{ color: textColor }}>${totalPrice.toFixed(2)}</strong>
              </div>
              {checkoutError && (
                <p className="text-sm text-red-600 mb-2">
                  {checkoutError}
                </p>
              )}
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="btn-primary w-full"
              >
                {checkoutLoading ? t('cart.checking_out') : t('cart.checkout')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
