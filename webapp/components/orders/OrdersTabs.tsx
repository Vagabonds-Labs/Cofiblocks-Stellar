'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { ExclamationTriangleIcon, TruckIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { filterConfig } from '@/config/myOrdersConfig'

type Props = {
  activeFilter: string
  onChange: (filter: string) => void
}

export const OrdersTabs = memo(function OrdersTabs({
  activeFilter,
  onChange,
}: Props) {
  const t = useTranslations()

  return (
    <div
      className="border-b border-gray-200 mb-8"
      role="tablist"
    >
      <div className="flex gap-6 overflow-x-auto overflow-y-hidden">
        {Object.entries(filterConfig).map(([key, cfg]) => {
          const isActive = activeFilter === key

          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(key)}
              className={`
                relative pb-4 text-base font-medium whitespace-nowrap
                transition-colors flex items-center gap-2
                ${
                  isActive
                    ? 'text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {key === 'pending_action' && (
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
              )}
              {key === 'pending_delivery' && (
                <TruckIcon className="w-5 h-5" />
              )}
              {key === 'delivered' && (
                <CheckCircleIcon className="w-5 h-5" />
              )}
              {t(cfg.labelKey)}

              {isActive && (
                <span
                  className="
                    absolute left-0 right-0 -bottom-px
                    h-0.5 bg-green-600 rounded-full
                  "
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
})
