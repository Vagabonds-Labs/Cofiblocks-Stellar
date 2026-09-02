'use client'

import { useState, useRef, useEffect } from 'react'
import { EllipsisVerticalIcon, ArrowRightCircleIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

interface TokenMenuProps {
  onTransfer: () => void
  onSwap?: () => void
  t: any
}

export function TokenMenu({ onTransfer, onSwap, t }: TokenMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleTransfer = () => {
    setIsOpen(false)
    onTransfer()
  }

  const handleSwap = () => {
    if (onSwap) {
      setIsOpen(false)
      onSwap()
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="
          p-1.5
          rounded-lg
          text-gray-400
          hover:text-gray-600
          hover:bg-gray-100
          transition
          focus:outline-none
          focus:ring-2
          focus:ring-orange-500
          focus:ring-offset-2
        "
        aria-label="Token options"
      >
        <EllipsisVerticalIcon className="w-5 h-5" />
      </button>

      {isOpen && (
        <div
          className="
            absolute
            right-0
            top-full
            mt-2
            w-48
            bg-white
            rounded-lg
            shadow-lg
            border
            border-gray-200
            py-1
            z-50
          "
        >
          <button
            onClick={handleTransfer}
            className="
              w-full
              px-4
              py-2
              text-left
              text-sm
              text-gray-700
              hover:bg-gray-50
              flex
              items-center
              gap-2
              transition
            "
          >
            <ArrowRightCircleIcon className="w-4 h-4" />
            {t('balances.menu_transfer') ?? 'Transfer to another wallet'}
          </button>
          {onSwap && (
            <button
              onClick={handleSwap}
              className="
                w-full
                px-4
                py-2
                text-left
                text-sm
                text-gray-700
                hover:bg-gray-50
                flex
                items-center
                gap-2
                transition
              "
            >
              <ArrowsRightLeftIcon className="w-4 h-4" />
              {t('balances.menu_swap') ?? 'Swap for USDC'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

