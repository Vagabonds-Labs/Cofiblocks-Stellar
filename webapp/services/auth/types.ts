import type { OrganizationKind, StaffRole } from '@/types/traceability'

/** How an account signs in. Each method has its own Stellar wallet. */
export type LoginMethod = 'email' | 'telegram' | 'wallet'

export interface User {
  id: string
  name: string | null
  email: string | null
  telegramUsername?: string | null
  walletAddress?: string | null
  walletProvider?: string | null
  loginMethod?: LoginMethod | null
  /** The email used with Cavos, or the Telegram name. */
  loginIdentity?: string | null
  /** Own wallets: freighter, lobstr, xbull… */
  walletApp?: string | null
  lastLoginAt?: string | null
  isAdmin?: boolean
  role?: StaffRole | null
  organizationId?: string | null
  collectionCenterId?: string | null
  roleTx?: string | null
  organization?: { id: string; name: string; code: string; kind: OrganizationKind } | null
  collectionCenter?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}
