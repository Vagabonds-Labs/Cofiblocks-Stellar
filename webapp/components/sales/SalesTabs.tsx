'use client'

import { useTranslations } from 'next-intl'
import { FilterType } from '@/hooks/sells/useMySales'

interface SalesTabsProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  pendingCount: number
  completedCount: number
  claimsCount: number
}

export function SalesTabs({
  activeFilter,
  onFilterChange,
  pendingCount,
  completedCount,
  claimsCount,
}: SalesTabsProps) {
  const t = useTranslations()

  return (
    <div
      className="border-b border-gray-200 mb-8"
      role="tablist"
      aria-label={t('my_sales.filters')}
    >
      <div className="flex gap-6 overflow-x-auto">
        {/* Pending */}
        <button
          role="tab"
          aria-selected={activeFilter === 'pending'}
          onClick={() => onFilterChange('pending')}
          className={`
            relative pb-3 text-sm font-medium whitespace-nowrap
            transition-colors
            ${
              activeFilter === 'pending'
                ? 'text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          {t('my_sales.pending_delivery')}
          <span className="ml-1 text-xs text-gray-400">
            ({pendingCount})
          </span>

          {activeFilter === 'pending' && (
            <span
              className="
                absolute left-0 right-0 -bottom-px
                h-0.5 bg-green-600 rounded-full
              "
            />
          )}
        </button>

        {/* Completed */}
        <button
          role="tab"
          aria-selected={activeFilter === 'completed'}
          onClick={() => onFilterChange('completed')}
          className={`
            relative pb-3 text-sm font-medium whitespace-nowrap
            transition-colors
            ${
              activeFilter === 'completed'
                ? 'text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          {t('my_sales.completed')}
          <span className="ml-1 text-xs text-gray-400">
            ({completedCount})
          </span>

          {activeFilter === 'completed' && (
            <span
              className="
                absolute left-0 right-0 -bottom-px
                h-0.5 bg-green-600 rounded-full
              "
            />
          )}
        </button>

        {/* Claims */}
        <button
          role="tab"
          aria-selected={activeFilter === 'claims'}
          onClick={() => onFilterChange('claims')}
          className={`
            relative pb-3 text-sm font-medium whitespace-nowrap
            transition-colors
            ${
              activeFilter === 'claims'
                ? 'text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          {t('my_sales.pending_claims')}

          {activeFilter === 'claims' && (
            <span
              className="
                absolute left-0 right-0 -bottom-px
                h-0.5 bg-green-600 rounded-full
              "
            />
          )}
        </button>
      </div>
    </div>
  )
}

