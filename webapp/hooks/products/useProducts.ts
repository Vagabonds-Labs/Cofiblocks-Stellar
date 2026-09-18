'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { productService, type Product } from '@/services/api/products'
import type { FilterState } from '@/types/products'

export function useProducts(filters: FilterState) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [retryCount, setRetryCount] = useState(0)
  const [catalogRegions, setCatalogRegions] = useState<string[]>([])
  const [catalogRoasts, setCatalogRoasts] = useState<string[]>([])
  const retry = useCallback(() => setRetryCount((count) => count + 1), [])

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

        if (controller.signal.aborted) return
        setProducts(list)
        // Keep all filter choices available when the results are narrowed down.
        if (!query) {
          setCatalogRegions(
            [...new Set(list.map((p) => p.farm.region).filter(Boolean))].sort()
          )
          setCatalogRoasts(
            [...new Set(list.map((p) => p.roastLevel).filter(Boolean))].sort()
          )
        }
      } catch (err: any) {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          setError(err?.message ?? 'Failed to load products')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadProducts()

    return () => controller.abort()
  }, [query, retryCount])

  // Memo: unique regions
  const uniqueRegions = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => p.farm.region && set.add(p.farm.region))
    return [...new Set([...catalogRegions, ...set])].sort()
  }, [products, catalogRegions])

  // Memo: roast levels
  const uniqueRoastLevels = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => p.roastLevel && set.add(p.roastLevel))
    return [...new Set([...catalogRoasts, ...set])].sort()
  }, [products, catalogRoasts])

  return {
    products,
    loading,
    error,
    uniqueRegions,
    uniqueRoastLevels,
    retry,
  }
}
