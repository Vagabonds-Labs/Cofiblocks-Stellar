'use client'

import { useState, useEffect, useMemo } from 'react'
import { productService, type Product } from '@/services/api/products'
import type { FilterState } from '@/types/products'

export function useProducts(filters: FilterState) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Convert filters → query string once
  const query = useMemo(() => {
    const params = new URLSearchParams()

    if (filters.search) params.append('search', filters.search)
    if (filters.region) params.append('region', filters.region)
    if (filters.roastLevel) params.append('roastLevel', filters.roastLevel)
    if (filters.minPrice) params.append('minPrice', filters.minPrice.toString())
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString())
    if (filters.grindType) params.append('grindType', filters.grindType)

    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [filters])

  // Fetch products on filter change
  useEffect(() => {
    const controller = new AbortController()

    const loadProducts = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await productService.getAllProducts(query, {
          signal: controller.signal,
        })
        const list = response || []

        setProducts(list)
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err?.message ?? 'Failed to load products')
        }
      } finally {
        setLoading(false)
      }
    }

    loadProducts()

    return () => controller.abort()
  }, [query])

  // Memo: unique regions
  const uniqueRegions = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => p.farm.region && set.add(p.farm.region))
    return [...set].sort()
  }, [products])

  // Memo: roast levels
  const uniqueRoastLevels = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => p.roastLevel && set.add(p.roastLevel))
    return [...set].sort()
  }, [products])

  return {
    products,
    loading,
    error,
    uniqueRegions,
    uniqueRoastLevels,
  }
}
