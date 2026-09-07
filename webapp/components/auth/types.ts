export interface LoginMethodsProps {
  walletError: string | null
  isConnecting: boolean
  onWallet: () => void | Promise<void>
}
