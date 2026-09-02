export interface LoginMethodsProps {
  walletError: string | null
  cavosError: string | null
  isConnecting: boolean
  isCavosLoading: boolean
  isCavosEnabled: boolean
  magicLinkSent?: boolean
  onWallet: () => void | Promise<void>
  onGoogle: () => void | Promise<void>
  onApple: () => void | Promise<void>
  onSendMagicLink?: (email: string) => Promise<void>
  onEmailFormVisible?: (visible: boolean) => void
}
