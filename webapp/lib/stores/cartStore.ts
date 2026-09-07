import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  productId: string
  amount: number
}

/**
 * Productos distintos que caben en una compra.
 *
 * `buy_products` los cobra todos en una sola transacción, y Soroban acota los
 * recursos por transacción. El contrato rechaza con `TooManyItems` por encima de
 * este número (medido por simulación contra el presupuesto de mainnet), así que
 * el carrito corta antes en vez de dejar que falle al final del checkout.
 *
 * Es el número de productos distintos, no de unidades: sumar más unidades de un
 * producto que ya está en el carrito no cuenta.
 */
export const MAX_CART_ITEMS = 16

interface CartState {
  items: CartItem[]
  /** `false` si el carrito ya está lleno y el producto no estaba en él. */
  addItem: (productId: string, amount: number) => boolean
  removeItem: (productId: string) => void
  updateItem: (productId: string, amount: number) => void
  clearCart: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId, amount) => {
        if (amount <= 0 || Number.isNaN(amount)) return false;

        const { items } = get()
        const existing = items.find(i => i.productId === productId)

        if (!existing && items.length >= MAX_CART_ITEMS) return false

        set((state) => {
          if (existing) {
            return {
              items: state.items.map(i =>
                i.productId === productId
                  ? { ...i, amount: i.amount + amount }
                  : i
              )
            }
          }

          return {
            items: [...state.items, { productId, amount }]
          }
        })
        return true
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter(i => i.productId !== productId),
        }))
      },

      updateItem: (productId, amount) => {
        if (amount <= 0 || Number.isNaN(amount)) {
          set((state) => ({
            items: state.items.filter(i => i.productId !== productId),
          }))
          return
        }

        set((state) => ({
          items: state.items.map(i =>
            i.productId === productId ? { ...i, amount } : i
          ),
        }))
      },

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'cofiblocks-cart',
    }
  )
)
