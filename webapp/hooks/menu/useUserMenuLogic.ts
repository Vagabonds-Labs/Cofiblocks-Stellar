import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useOutsideClick } from '../ui/useOutsideClick'
import { formatDisplayName } from '../../utils/formatting'
import { authService } from '@/services/auth/authService'
import { useOptionalCavos } from '../auth/useOptionalCavos'

interface UserMenuLogicProps {
    isLoggedIn: boolean
    userName: string
    walletAddress: string
}

export function useUserMenuLogic({ isLoggedIn, userName, walletAddress }: UserMenuLogicProps) {
    const router = useRouter()
    const { cavos: { logout: cavosLogout, isAuthenticated } } = useOptionalCavos()
  
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
        if (isAuthenticated) await cavosLogout?.()
      } catch (err) {
        console.error("Cavos logout error:", err)
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
  
