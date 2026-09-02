'use client'

import { 
  CheckCircleIcon, 
  ArrowRightStartOnRectangleIcon,
  UserIcon,
  CubeIcon,
  ShieldCheckIcon,
  CalendarIcon,
  ListBulletIcon
} from '@heroicons/react/24/outline'

import NextImage from "next/image"
import { useTranslations } from 'next-intl';

import { UserMenuProps } from './types'
import { useUserMenuLogic } from '../../hooks/menu/useUserMenuLogic'

export function UserMenu({
  isLoggedIn,
  userName,
  walletAddress,
  sellerType,
  isAdmin,
  textColor,
  progress,
  bottom
}: UserMenuProps) {

  const t = useTranslations()

  const {
    menuRef,
    displayName,
    isMenuOpen,
    toggleMenu,
    go,
    logout,
  } = useUserMenuLogic({ isLoggedIn, userName, walletAddress })

  return (
    <div className="relative" ref={menuRef}>
      
      {/* Button */}
      <button
        onClick={toggleMenu}
        className="
          flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl
          transition-all duration-300
          hover:bg-[rgba(40,107,86,0.12)]
        "
        style={{ color: textColor }}
      >
        <NextImage
          src="/images/circle-user-round.svg"
          alt={isLoggedIn ? t('header.user_menu_alt') : t('header.login_alt')}
          width={44}
          height={44}
          className="w-11 h-11 transition duration-500"
          style={{ filter: 'invert(0)' }}
        />
        <span className="text-xs font-semibold">{displayName}</span>
      </button>

      {/* Dropdown */}
      {isLoggedIn && isMenuOpen && (
        <div
          className="
            absolute right-0 mt-2 w-56 rounded-2xl shadow-[0_18px_42px_rgba(12,35,26,0.18)]
            border backdrop-blur-xl z-50 transition-all duration-200
          "
          style={{
            backgroundColor: `rgba(${bottom}, ${bottom}, ${bottom}, 0.96)`,
            borderColor: `rgba(211,220,214,0.9)`,
          }}
        >
          <div className="py-1">

            <button onClick={go('/profile')} className="menu-item" style={{ color: textColor }}>
              <UserIcon className="w-5 h-5" />
              {t('user_menu.button_profile')}
            </button>

            <button onClick={go('/my-orders')} className="menu-item" style={{ color: textColor }}>
              <CheckCircleIcon className="w-5 h-5" />
              {t('user_menu.button_orders')}
            </button>

            {sellerType && (
            <>
              <div className="px-3 py-2 mt-1">
                <div className="text-xs font-medium mb-1.5" style={{ color: `rgba(150, 150, 150, ${0.6 + progress * 0.4})` }}>
                  {t('user_menu.section_seller')}
                </div>
                <div className="h-px" style={{ backgroundColor: `rgba(150, 150, 150, ${0.3 + progress * 0.2})` }}></div>
              </div>
              <button onClick={go('/seller/my-products')} className="menu-item" style={{ color: textColor }}>
                <CubeIcon className="w-5 h-5" />
                {t('user_menu.button_my_products')}
              </button>
              {sellerType === 'PRODUCER' && (
                <button onClick={go('/seller/my-farms')} className="menu-item" style={{ color: textColor }}>
                  <CubeIcon className="w-5 h-5" />
                  {t('user_menu.button_my_farms')}
                </button>
              )}
              <button onClick={go('/seller/my-sales')} className="menu-item" style={{ color: textColor }}>
                <CubeIcon className="w-5 h-5" />
                {t('user_menu.button_my_sales')}
              </button>
            </>
            )}

            {isAdmin && (
              <>
                <div className="px-3 py-2 mt-1">
                  <div className="text-xs font-medium mb-1.5" style={{ color: `rgba(150, 150, 150, ${0.6 + progress * 0.4})` }}>
                    {t('user_menu.section_admin')}
                  </div>
                  <div className="h-px" style={{ backgroundColor: `rgba(150, 150, 150, ${0.3 + progress * 0.2})` }}></div>
                </div>
                <button onClick={go('/admin/dashboard')} className="menu-item" style={{ color: textColor }}>
                  <ShieldCheckIcon className="w-5 h-5" />
                  {t('user_menu.manage_users')}
                </button>
                <button onClick={go('/admin/events')} className="menu-item" style={{ color: textColor }}>
                  <CalendarIcon className="w-5 h-5" />
                  {t('user_menu.manage_events')}
                </button>
                <button onClick={go('/admin/contracts')} className="menu-item" style={{ color: textColor }}>
                  <CubeIcon className="w-5 h-5" />
                  {t('user_menu.manage_contracts')}
                </button>
                <button onClick={go('/admin/orders')} className="menu-item" style={{ color: textColor }}>
                  <ListBulletIcon className="w-5 h-5" />
                  {t('user_menu.manage_orders')}
                </button>
              </>
            )}

            <button onClick={logout} className="menu-item menu-item-danger mt-2" style={{ color: textColor }}>
              <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
              {t('user_menu.button_logout')}
            </button>

          </div>
        </div>
      )}
    </div>
  )
}
