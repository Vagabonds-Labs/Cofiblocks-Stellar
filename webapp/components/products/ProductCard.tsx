'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation'
import { ShoppingCartIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline'

import { ProductCardProps } from './types'
import { MAX_CART_ITEMS, useCart } from '@/lib/stores/cartStore'


export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations();
  const router = useRouter()
  const [cartFullError, setCartFullError] = useState<string | null>(null)
  const items = useCart(state => state.items)
  const addItem = useCart(state => state.addItem)
  const updateItem = useCart(state => state.updateItem)
  const removeItem = useCart(state => state.removeItem)
  const availableStock = product.currentStock - product.reservedStock

  const cartItem = items.find(item => item.productId === product.id)
  const quantity = cartItem?.amount ?? 0
  const isInCart = quantity > 0

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the button
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    router.push(`/products/${product.id}`)
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!addItem(product.id, 1)) {
      setCartFullError(t('cart.error_full', { max: MAX_CART_ITEMS }))
    }
  }

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (quantity > 1 && (quantity - 1) <= availableStock) {
      updateItem(product.id, quantity - 1)
    } else {
      removeItem(product.id)
    }
  }

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    const maxStock = availableStock ?? Infinity
    if (quantity < maxStock) {
      updateItem(product.id, quantity + 1)
    } else if (quantity >= availableStock) {
      updateItem(product.id, availableStock)
    }
  }

  return (
    <div 
      onClick={handleCardClick}
      className="surface-card overflow-hidden hover:shadow-[0_14px_36px_rgba(18,44,33,0.14)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
    >
      <div className="aspect-square w-full overflow-hidden bg-[linear-gradient(135deg,rgba(247,251,248,0.85),rgba(233,241,236,0.95))]">
        <img
          src={product.imageUrl ?? ''}
          alt={product.title}
          className="w-full h-full object-contain p-4"
        />
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-[rgb(24,33,29)] mb-1 leading-tight">{product.title}</h3>
        <p className="text-sm text-[rgb(90,103,96)] mb-2">{product.farm.region}</p>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="chip chip-warm">
            {product.roastLevel}
          </span>
          <span className="chip chip-neutral">
            {product.grindType === 'WHOLE' ? t('home.option_whole') : t('home.option_ground')}
          </span>
        </div>
        <div className="mt-auto pt-3">
          <p className="text-xl font-bold text-[rgb(24,33,29)] mb-3">${product.price.toFixed(2)}</p>
          {!isInCart ? (
            <button
              onClick={handleAddToCart}
              disabled={product.currentStock !== undefined && availableStock === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              <ShoppingCartIcon className="w-5 h-5" />
              {availableStock === 0 
                ? t('product.out_of_stock') 
                : t('product.button_add_to_cart')}
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-3 bg-[rgb(40,107,86)] text-white text-sm font-medium py-2.5 px-4 rounded-xl">
              <button
                onClick={handleDecrease}
                className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/20 transition-colors"
              >
                <MinusIcon className="w-4 h-4" />
              </button>
              <span className="min-w-[2rem] text-center font-semibold">{quantity}</span>
              <button
                onClick={handleIncrease}
                className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={availableStock !== undefined && quantity >= availableStock}
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {cartFullError && (
            <p className="mt-2 text-xs text-red-700">{cartFullError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
