'use client'

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link'
import NextImage from "next/image";
import { useState, useEffect } from 'react'

import { useUser } from '@/lib/providers/UserProvider'
import { UserMenu } from '../menu'
import { NotificationDropdown } from '../notifications'
import { CartDropdown } from '../cart'

export function Header() {
  const t = useTranslations();
  const languages = [
    { code: 'en', flag: '🇬🇧', name: 'English' },
    { code: 'es', flag: '🇪🇸', name: 'Español' },
    { code: 'pt', flag: '🇧🇷', name: 'Português' },
  ]

  const locale = useLocale();

  // Load language from localStorage or use current locale
  const getInitialLanguage = (): string => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cofiblocks-language')
      if (saved && (saved === 'en' || saved === 'es' || saved === 'pt')) {
        return saved
      }
    }
    return locale || 'en'
  }

  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => getInitialLanguage())
  const { user } = useUser()
  
  // Derive user info from context
  const userName = user?.name || ''
  const walletAddress = user?.walletAddress || ''
  const sellerType = user?.sellerType || null
  const isAdmin = user?.isAdmin || false
  const isLoggedIn = !!user

  // Load saved language on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cofiblocks-language')
      if (saved && (saved === 'en' || saved === 'es' || saved === 'pt')) {
        setSelectedLanguage(saved)
      } else {
        setSelectedLanguage(locale || 'en')
      }
    }
  }, [locale])

  const textColor = 'rgb(24, 33, 29)'
  const progress = 0
  const bottom = 248

  return (
    <header
      className="
        sticky top-0 z-50
        backdrop-blur-xl bg-white/80
        transition-all duration-200 
        ease-[cubic-bezier(.4,0,.2,1)]
        border-b border-white/70
        shadow-[0_8px_30px_rgba(28,46,36,0.08)]
      "
      style={{ color: textColor }}
    >
      <div className="app-container py-2">
        <div className="flex items-center justify-between h-16" style={{ color: textColor }}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <NextImage
              src="/images/logo.png"
              alt="CofiBlocks"
              width={40}
              height={64}
              className="w-10 h-14"
              priority
            />
            <span className="hidden sm:inline text-sm font-semibold tracking-wide">COFIBLOCKS</span>
          </Link>

          {/* Right controls */}
          <nav className="flex items-center gap-2 sm:gap-4 md:gap-6">

            {/* Language Selector */}
            <select
              value={selectedLanguage}
              onChange={(e) => {
                const lang = e.target.value;
                setSelectedLanguage(lang);
                // Save to localStorage and cookie
                if (typeof window !== 'undefined') {
                  localStorage.setItem('cofiblocks-language', lang);
                  document.cookie = `cofiblocks-language=${lang}; path=/; max-age=31536000`;
                  // Reload page to apply new locale
                  window.location.reload();
                }
              }}
              className="
                field-input max-w-[95px] px-2.5 py-2 text-sm
                transition-all duration-300
                cursor-pointer
              "
              aria-label={t('header.language_selector')}
            >
              {languages.map((lang) => (
                <option 
                  key={lang.code} 
                  value={lang.code}
                >
                  {lang.flag} {lang.code.toUpperCase()}
                </option>
              ))}
            </select>


            {/* Cart */}
            <CartDropdown
              textColor={textColor}
              progress={progress}
              bottom={bottom}
            />

            {/* Notifications */}
            <NotificationDropdown
              isLoggedIn={isLoggedIn}
              selectedLanguage={selectedLanguage}
              textColor={textColor}
              progress={progress}
              bottom={bottom}
            />

            {/* User Menu */}
            <UserMenu
              isLoggedIn={isLoggedIn}
              userName={userName}
              walletAddress={walletAddress}
              sellerType={sellerType}
              isAdmin={isAdmin}
              textColor={textColor}
              progress={progress}
              bottom={bottom}
            />

          </nav>
        </div>
      </div>
    </header>
  )
}
