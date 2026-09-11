export interface LoginMethodsProps {
  walletError: string | null
  isConnecting: boolean
  onWallet: () => void | Promise<void>
  /** Se llama cuando termina el login con email o Google (Privy). */
  onEmailLoggedIn: () => void
}
