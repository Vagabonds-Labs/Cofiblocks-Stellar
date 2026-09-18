// hooks/useProductFilters.ts
import { useState, useCallback } from 'react'
import type { FilterState } from '@/types/products'

export function useProductFilters() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    region: '',
    roastLevel: '',
    minPrice: '',
    maxPrice: '',
    grindType: '',
  })

  const updateFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateSearch = useCallback(
    (value: string) => updateFilter('search', value),
    [updateFilter]
  )

  return {
    filters,
    updateFilter,
    updateSearch,
    setFilters,
    resetFilters: () =>
      setFilters({
        search: '',
        region: '',
        roastLevel: '',
        minPrice: '',
        maxPrice: '',
        grindType: '',
      }),
  }
}
