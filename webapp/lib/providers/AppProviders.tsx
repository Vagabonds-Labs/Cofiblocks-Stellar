'use client'

import { ReactNode, useMemo } from 'react'
import { CavosProvider } from '@cavos/react'
import { UserProvider } from './UserProvider'

interface SessionConfig {
  defaultPolicy: {
    allowedContracts: string[]
    maxCallsPerTx: number
    spendingLimits: {
      token: string
      limit: string | number
    }[]
  }
}

interface AppProvidersProps {
  children: ReactNode
  cavosConfig?: {
    appId: string
    network: 'mainnet' | 'sepolia'
    starknetRpcUrl: string,
    paymasterApiKey: string
    session: SessionConfig
  }
}

export function AppProviders({ children, cavosConfig }: AppProvidersProps) {
  const normalizedCavosConfig = useMemo(() => {
    if (!cavosConfig) return null

    return {
      ...cavosConfig,
      paymasterApiKey: "cav_BeI9F9MjU2aZi4ha7JpflyrRlFDyLg_71AIuAD8AOU6ZQDsV",
      session: {
        ...cavosConfig.session,
        defaultPolicy: {
          ...cavosConfig.session.defaultPolicy,
          spendingLimits: cavosConfig.session.defaultPolicy.spendingLimits.map((limit) => ({
            ...limit,
            limit: BigInt(limit.limit),
          })),
        },
      },
    }
  }, [cavosConfig]);

  const content = (
    <UserProvider>
      {children}
    </UserProvider>
  )

  if (!normalizedCavosConfig) {
    return content
  }

  return (
    <CavosProvider config={normalizedCavosConfig}>
      {content}
    </CavosProvider>
  )
}
