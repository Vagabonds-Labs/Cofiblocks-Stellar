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
  const [isScrolled, setIsScrolled] = useState(false)
  const { user } = useUser()

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 24)
    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollState)
  }, [])

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
    <>
      <div role="note" className="bg-[#284e3b] text-white">
        <p className="app-container py-2.5 text-center text-xs leading-relaxed sm:text-sm">
          <span className="font-semibold">{t('header.demo_notice')}</span>{' '}
          <span className="text-[#e4eddf]">{t('header.full_version_soon')}</span>
        </p>
      </div>
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl
          transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none
          ${isScrolled
            ? 'border-[#d8cfbd] bg-[#eee8dc] shadow-[0_4px_18px_rgba(36,60,46,0.08)]'
            : 'border-[#e7e4db] bg-white/80'
          }`}
        style={{ color: textColor }}
      >
        <div className="app-container py-2">
          <div className="flex items-center justify-between h-16" style={{ color: textColor }}>

            {/* Logo */}
            <Link href={`/${locale}`} className="flex items-center gap-2">
              <NextImage
                src="/images/logo.png"
                alt="CofiBlocks"
                width={40}
                height={64}
                className="w-10 h-auto"
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
              {isLoggedIn && <NotificationDropdown
                isLoggedIn={isLoggedIn}
                selectedLanguage={selectedLanguage}
                textColor={textColor}
                progress={progress}
                bottom={bottom}
              />}

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
    </>
  )
}
