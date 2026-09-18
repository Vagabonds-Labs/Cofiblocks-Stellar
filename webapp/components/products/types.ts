import { ProductStatus } from '@/services/api/products/types'
import { MyProduct } from '@/hooks/products/useMyProducts'
import { FilterState } from '@/types/products'

export interface ProductCardProps {
  product: Product
}

export interface Product {
  id: string
  title: string
  description: string | null
  roastLevel: string
  grindType: 'WHOLE' | 'GROUND'
  price: number
  currentStock: number
  reservedStock: number
  imageUrl: string | null
  status: ProductStatus
  farm: {
    region: string
    name?: string
  }
}

export interface FilterSidebarProps {
  filters: FilterState
  onFilterChange: (key: keyof FilterState, value: string) => void
  onReset: () => void
  uniqueRegions: string[]
  uniqueRoastLevels: string[]
}

export interface MyProductCardProps {
  product: MyProduct
  onDeploySuccess?: () => void
}
