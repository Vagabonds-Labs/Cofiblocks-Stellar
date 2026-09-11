'use client'

import { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'

import { UserProvider } from './UserProvider'
import { PrivyBridge } from '@/components/auth/PrivyBridge'
import { PRIVY_LOGIN_METHODS } from '@/lib/auth/loginMethods'

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID

/**
 * Proveedores de la app.
 *
 * Hay dos formas de entrar: con una wallet de Stellar (Stellar Wallets Kit, que
 * no necesita provider) o con email o Google, a través de Privy, que le crea al
 * usuario una wallet embebida. Sin `NEXT_PUBLIC_PRIVY_APP_ID` queda sólo la
 * primera.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const content = <UserProvider>{children}</UserProvider>
  if (!PRIVY_APP_ID) return content

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Cada método es una cuenta de Privy distinta —y por lo tanto otra
        // wallet— salvo que el usuario los vincule desde su perfil
        // (LoginMethodsLinks). Qué métodos están activos se decide en
        // lib/auth/loginMethods.
        loginMethods: PRIVY_LOGIN_METHODS,
        appearance: { theme: 'light', accentColor: '#f97316' },
        // La wallet Stellar se crea a mano después del login (usePrivyLogin);
        // las de Ethereum y Solana no las queremos.
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' },
        },
      }}
    >
      <PrivyBridge />
      {content}
    </PrivyProvider>
  )
}
