export interface UserMenuProps {
    isLoggedIn: boolean
    userName: string
    walletAddress: string
    sellerType: 'PRODUCER' | 'ROASTER' | null
    isAdmin?: boolean
    textColor: string
    progress: number
    bottom: number
  }