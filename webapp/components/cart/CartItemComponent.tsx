'use client'

import NextImage from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MinusIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

import { useCart } from '@/lib/stores/cartStore'
import { CartItemComponentProps } from './types'


export function CartItemComponent({ cartItem, product, textColor, progress }: CartItemComponentProps) {
  const t = useTranslations()
  const updateItem = useCart(state => state.updateItem)
  const removeItem = useCart(state => state.removeItem)
  const router = useRouter()
  const availableStock = product.currentStock - product.reservedStock
  if (availableStock == 0) {
    removeItem(cartItem.productId)
  } else if (availableStock < cartItem.amount) {
    updateItem(cartItem.productId, availableStock)
  }

  const itemTotal = product.price * cartItem.amount

  const handleDecrease = () => {
    if (cartItem.amount > 1 && (cartItem.amount - 1) <= availableStock) {
      updateItem(cartItem.productId, cartItem.amount - 1)
    } else {
      removeItem(cartItem.productId)
    }
  }

  const handleIncrease = () => {
    if (cartItem.amount < availableStock) {
      updateItem(cartItem.productId, cartItem.amount + 1)
    } else if (cartItem.amount >= availableStock) { 
      updateItem(cartItem.productId, availableStock)
    }
  }

  const handleRemove = () => {
    removeItem(cartItem.productId)
  }

  const handleProductClick = () => {
    router.push(`/products/${product.id}`)
  }

  return (
    <div 
      className="flex items-center gap-2 p-2 md:gap-3 md:p-3 border-b last:border-b-0"
      style={{ borderColor: `rgba(150,150,150,${progress})` }}
    >
      {/* Product Image */}
      <div 
        className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-md overflow-hidden cursor-pointer"
        style={{ backgroundColor: `rgba(150,150,150,${progress * 0.3})` }}
        onClick={() => handleProductClick()}
      >
        {product.imageUrl ? (
          <NextImage
            src={product.imageUrl}
            alt={product.title}
            width={20}
            height={20}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] md:text-xs" style={{ color: textColor, opacity: 0.6 }}>
            No Image
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleProductClick()}>
        <h4 className="text-xs md:text-sm font-semibold truncate" style={{ color: textColor }}>{product.title}</h4>
        <p className="text-[10px] md:text-xs mt-0.5 md:mt-0.5" style={{ color: textColor, opacity: 0.7 }}>
          {product.grindType === 'WHOLE' ? t('home.option_whole') : t('home.option_ground')}
        </p>
        <p className="text-[10px] md:text-xs mt-0.5 md:mt-0.5" style={{ color: textColor, opacity: 0.7 }}>
          ${product.price.toFixed(2)} each
        </p>
        <p className="text-[10px] md:text-xs font-semibold mt-0.5 md:mt-0.5" style={{ color: textColor }}>
          Total: ${itemTotal.toFixed(2)}
        </p>
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-1 md:gap-1.5">
        <button
          onClick={handleDecrease}
          className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md transition-colors"
          style={{
            border: `1px solid rgba(150,150,150,${progress})`,
            color: textColor,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(150,150,150,${progress * 0.3})`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <MinusIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
        </button>
        <span className="min-w-[1.5rem] md:min-w-[1.75rem] text-center text-xs md:text-sm font-semibold" style={{ color: textColor }}>
          {cartItem.amount}
        </span>
        <button
          onClick={handleIncrease}
          className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            border: `1px solid rgba(150,150,150,${progress})`,
            color: textColor,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(150,150,150,${progress * 0.3})`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
          disabled={cartItem.amount >= availableStock}
        >
          <PlusIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
        </button>
      </div>

      {/* Remove Button */}
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1 md:p-1.5 transition-colors"
        style={{ 
          color: textColor,
          opacity: 0.6,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ef4444'
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = textColor
          e.currentTarget.style.opacity = '0.6'
        }}
        title="Remove from cart"
      >
        <XMarkIcon className="w-4 h-4 md:w-4.5 md:h-4.5" />
      </button>
    </div>
  )
}
