'use client'

import { useState, useEffect } from 'react'
import { productService } from '@/services/api/products'

export type ProductStatus = 'CREATION_REQUEST' | 'PUBLISHED' | 'HIDDEN' | 'CREATION_CANCELLED'

export interface MyProduct {
  id: string
  title: string
  roastLevel: string
  grindType: 'WHOLE' | 'GROUND'
  price: number
  currentStock: number
  imageUrl: string | null
  status: ProductStatus
  farm: {
    region: string
  }
}

interface ProductResponse {
  id: string
  title: string
  roastLevel: string
  grindType: 'WHOLE' | 'GROUND'
  price: number
  currentStock: number
  imageUrl: string | null
  status: ProductStatus
  farm: {
    region: string
  }
}

export function useMyProducts() {
  const [products, setProducts] = useState<MyProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await productService.getMyProducts()
      const productsArray = response || []
      
      // Map backend ProductResponse to frontend MyProduct type
      const mappedProducts: MyProduct[] = productsArray.map((product) => ({
        id: product.id,
        title: product.title,
        roastLevel: product.roastLevel,
        grindType: product.grindType,
        price: product.price,
        currentStock: product.currentStock,
        imageUrl: product.imageUrl,
        status: product.status as ProductStatus,
        farm: product.farm,
      }))
      
      setProducts(mappedProducts)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  return { products, loading, error, refetch: fetchProducts }
}

