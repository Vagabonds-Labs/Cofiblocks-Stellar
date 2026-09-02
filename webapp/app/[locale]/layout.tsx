// app/[locale]/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'

import { AppProviders } from '@/lib/providers/AppProviders'
import { Footer } from '@/components/footer/Footer'
import { Header } from '@/components/header/Header'

export const metadata: Metadata = {
  title: 'CofiBlocks - OnChain Coffee Marketplace',
  description: 'Discover and purchase premium coffee from Costa Rica using StarkNet technology',
}

type CavosRuntimeConfig = {
  appId: string
  network: 'mainnet' | 'sepolia'
  starknetRpcUrl: string,
  paymasterApiKey: string,
  session: {
    defaultPolicy: {
      allowedContracts: string[]
      maxCallsPerTx: number
      spendingLimits: {
        token: string
        limit: string
      }[]
    }
  }
}

const CAVOS_CONFIG_MAX_ATTEMPTS = 5
const CAVOS_CONFIG_MIN_DELAY_MS = 3000
const CAVOS_CONFIG_MAX_DELAY_MS = 7000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelayMs() {
  return Math.floor(
    Math.random() * (CAVOS_CONFIG_MAX_DELAY_MS - CAVOS_CONFIG_MIN_DELAY_MS + 1)
  ) + CAVOS_CONFIG_MIN_DELAY_MS
}

function getCavosConfigUrl(backendBaseUrl: string) {
  const normalizedBaseUrl = backendBaseUrl
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')

  return `${normalizedBaseUrl}/api/config/cavos`
}

async function getCavosConfigFromBackend(): Promise<CavosRuntimeConfig | null> {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_URL
  if (!backendBaseUrl) return null
  const cavosConfigUrl = getCavosConfigUrl(backendBaseUrl)

  for (let attempt = 1; attempt <= CAVOS_CONFIG_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(cavosConfigUrl, {
        method: 'GET',
        cache: 'no-store',
      })

      if (response.ok) {
        const payload = await response.json() as { data?: CavosRuntimeConfig }
        if (payload?.data) {
          return payload.data
        }
      }
    } catch {
      // Retry below until attempts are exhausted.
    }

    if (attempt < CAVOS_CONFIG_MAX_ATTEMPTS) {
      await sleep(randomDelayMs())
    }
  }

  return null
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const cavosConfig = await getCavosConfigFromBackend()

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <AppProviders
          cavosConfig={cavosConfig ?? undefined}
        >
          <NextIntlClientProvider messages={messages}>
            <Header />
            <div className="flex-1">{children}</div>
            <Footer />
          </NextIntlClientProvider>
        </AppProviders>
      </body>
    </html>
  )
}
