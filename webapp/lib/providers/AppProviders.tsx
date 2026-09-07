'use client'

import { ReactNode } from 'react'
import { UserProvider } from './UserProvider'

/**
 * Sólo queda el proveedor de usuario.
 *
 * Se fue `CavosProvider`: no hay magic link, ni Google, ni Apple. El único
 * camino de entrada es firmar con la wallet, y de eso se encarga el Stellar
 * Wallets Kit desde `services/wallet/walletService`, que no necesita provider.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <UserProvider>{children}</UserProvider>
}
