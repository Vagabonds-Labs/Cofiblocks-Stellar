'use client'

import { useEffect, useState } from 'react'

import { productService, Product } from '@/services/api/products'
import { CartItem } from '@/lib/stores/cartStore'

export function useCartProducts(showCart: boolean, items: CartItem[]) {
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!showCart || items.length === 0) return

    const fetchProducts = async () => {
      setLoading(true)
      try {
        const productMap = new Map<string, Product>()

        const results = await Promise.all(
          items.map(async (item) => {
            try {
              const res = await productService.getProductById(item.productId)
              return { id: item.productId, product: res }
            } catch {
              return null
            }
          })
        )

        results.forEach(r => {
          if (r) productMap.set(r.id, r.product)
        })

        setProducts(productMap)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [showCart, items])

  return { products, loading }
}
