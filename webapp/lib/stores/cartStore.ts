import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  productId: string
  amount: number
}

interface CartState {
  items: CartItem[]
  addItem: (productId: string, amount: number) => void
  removeItem: (productId: string) => void
  updateItem: (productId: string, amount: number) => void
  clearCart: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (productId, amount) => {
        if (amount <= 0 || Number.isNaN(amount)) return;

        set((state) => {
          const existing = state.items.find(i => i.productId === productId)

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
