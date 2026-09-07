import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useOutsideClick } from '../ui/useOutsideClick'
import { formatDisplayName } from '../../utils/formatting'
import { authService } from '@/services/auth/authService'
import { walletService } from '@/services/wallet/walletService'

interface UserMenuLogicProps {
    isLoggedIn: boolean
    userName: string
    walletAddress: string
}

export function useUserMenuLogic({ isLoggedIn, userName, walletAddress }: UserMenuLogicProps) {
    const router = useRouter()
    const menuRef = useRef<HTMLDivElement>(null)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
  
    useOutsideClick(menuRef, () => setIsMenuOpen(false))
  
    const displayName = formatDisplayName(walletAddress, userName)
  
    const toggleMenu = () => {
      if (!isLoggedIn) router.push('/login')
      else setIsMenuOpen(v => !v)
    }
  
    const go = (path: string) => () => {
      setIsMenuOpen(false)
      router.push(path)
    }
  
    const logout = async () => {
      try {
        await walletService.disconnect()
      } catch (err) {
        console.error("Wallet disconnect error:", err)
      }

      await authService.logout()
      window.location.reload()
    }
  
    return {
      menuRef,
      displayName,
      isMenuOpen,
      toggleMenu,
      go,
      logout,
    }
  }
  
