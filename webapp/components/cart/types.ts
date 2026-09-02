import { Product } from '@/services/api/products'
import { CartItem } from '@/lib/stores/cartStore'

export interface CartDropdownProps {
    textColor: string
    progress: number
    bottom: number
}

export interface CartItemComponentProps {
    cartItem: CartItem
    product: Product
    textColor: string
    progress: number
  }
  