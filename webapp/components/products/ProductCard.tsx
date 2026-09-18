'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  ShoppingBagIcon,
  MinusIcon,
  PlusIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'

import { ProductCardProps } from './types'
import { MAX_CART_ITEMS, useCart } from '@/lib/stores/cartStore'

export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations()
  const locale = useLocale()
  const [cartFullError, setCartFullError] = useState<string | null>(null)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const items = useCart((state) => state.items)
  const addItem = useCart((state) => state.addItem)
  const updateItem = useCart((state) => state.updateItem)
  const removeItem = useCart((state) => state.removeItem)
  const availableStock = Math.max(
    0,
    product.currentStock - product.reservedStock
  )
  const quantity =
    items.find((item) => item.productId === product.id)?.amount ?? 0
  const productHref = `/${locale}/products/${product.id}`

  const handleAddToCart = () => {
    if (availableStock <= 0) return
    setCartFullError(
      addItem(product.id, 1)
        ? null
        : t('cart.error_full', { max: MAX_CART_ITEMS })
    )
  }

  const handleDecrease = () => {
    if (quantity > 1 && availableStock > 0)
      updateItem(product.id, Math.min(quantity - 1, availableStock))
    else removeItem(product.id)
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e3d9] bg-white transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(35,54,39,0.08)]">
      <Link
        href={productHref}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[4/3] overflow-hidden bg-[#f1efe8]"
      >
        {product.imageUrl && failedImage !== product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setFailedImage(product.imageUrl)}
            className="h-full w-full object-contain p-5 transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#81907d]">
            <ShoppingBagIcon className="h-12 w-12" />
            <span className="text-xs">{t('home.image_unavailable')}</span>
          </div>
        )}
        {availableStock <= 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#6c7267]">
            {t('product.out_of_stock')}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4 lg:p-5">
        <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#73816c]">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {product.farm.region}
        </p>
        <h3 className="text-base font-bold leading-snug text-[#293e2e]">
          <Link
            href={productHref}
            className="hover:underline hover:underline-offset-4"
          >
            {product.title}
          </Link>
        </h3>
        {product.farm.name && (
          <p className="mt-1 text-xs text-[#6c7267]">{product.farm.name}</p>
        )}
        <div className="mb-4 mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-[#f4ecdf] px-2 py-1 text-[11px] font-medium text-[#816040]">
            {product.roastLevel}
          </span>
          <span className="rounded-md bg-[#eef1e9] px-2 py-1 text-[11px] font-medium text-[#59704e]">
            {product.grindType === 'WHOLE'
              ? t('home.option_whole')
              : t('home.option_ground')}
          </span>
        </div>
        <div className="mt-auto border-t border-[#f0eee7] pt-4">
          <p className="mb-3 text-xl font-bold tracking-tight text-[#293e2e]">
            {new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: 'USD',
            }).format(product.price)}
          </p>
          {quantity === 0 ? (
            <button
              onClick={handleAddToCart}
              disabled={availableStock <= 0}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#284e3b] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1c392b] disabled:cursor-not-allowed disabled:bg-[#e9e9e2] disabled:text-[#72796b]"
            >
              <ShoppingBagIcon className="h-4 w-4" aria-hidden="true" />
              {availableStock <= 0
                ? t('product.out_of_stock')
                : t('product.button_add_to_cart')}
            </button>
          ) : (
            <div className="flex w-full items-center justify-between rounded-xl bg-[#eaf0e6] text-[#284e3b]">
              <button
                onClick={handleDecrease}
                aria-label={t('home.decrease_quantity', {
                  product: product.title,
                })}
                className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[#dce7d6]"
              >
                <MinusIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold" aria-live="polite">
                {t('home.in_cart', { count: quantity })}
              </span>
              <button
                onClick={() =>
                  quantity < availableStock &&
                  updateItem(product.id, quantity + 1)
                }
                aria-label={t('home.increase_quantity', {
                  product: product.title,
                })}
                disabled={quantity >= availableStock}
                className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[#dce7d6] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PlusIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          {cartFullError && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {cartFullError}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
