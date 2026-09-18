'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { FilterSidebarProps } from './types'

export function FilterSidebar({
  filters,
  onFilterChange,
  onReset,
  uniqueRegions,
  uniqueRoastLevels,
}: FilterSidebarProps) {
  const t = useTranslations()
  const [isExpanded, setIsExpanded] = useState(false)
  const activeCount = Object.values(filters).filter(Boolean).length
  const invalidRange =
    filters.minPrice !== '' &&
    filters.maxPrice !== '' &&
    Number(filters.minPrice) > Number(filters.maxPrice)

  return (
    <div className="rounded-2xl border border-[#e3dfd5] bg-[#f5f3ed] p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#304335]">
          <AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden="true" />
          {t('home.title_filters')}
          {activeCount > 0 && (
            <span className="rounded-full bg-[#e2e7da] px-2 py-0.5 text-xs">
              {activeCount}
            </span>
          )}
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#deded3] lg:hidden"
          aria-label={t(
            isExpanded ? 'home.collapse_filters' : 'home.expand_filters'
          )}
          aria-expanded={isExpanded}
          aria-controls="coffee-filters"
        >
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
      <div
        id="coffee-filters"
        className={`mt-5 space-y-5 ${isExpanded ? 'block' : 'hidden'} lg:block`}
      >
        <div>
          <label
            htmlFor="coffee-region"
            className="mb-2 block text-xs font-semibold text-[#53634f]"
          >
            {t('home.label_region')}
          </label>
          <select
            id="coffee-region"
            value={filters.region}
            onChange={(e) => onFilterChange('region', e.target.value)}
            className="field-input text-sm"
          >
            <option value="">{t('home.option_all_regions')}</option>
            {[...new Set([...uniqueRegions, filters.region])]
              .filter(Boolean)
              .map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="coffee-roast"
            className="mb-2 block text-xs font-semibold text-[#53634f]"
          >
            {t('home.label_roast_level')}
          </label>
          <select
            id="coffee-roast"
            value={filters.roastLevel}
            onChange={(e) => onFilterChange('roastLevel', e.target.value)}
            className="field-input text-sm"
          >
            <option value="">{t('home.option_all_roast_levels')}</option>
            {[...new Set([...uniqueRoastLevels, filters.roastLevel])]
              .filter(Boolean)
              .map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
          </select>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-[#53634f]">
            {t('home.label_price_range')}
          </legend>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label={t('home.price_min')}
              placeholder={t('home.price_min')}
              value={filters.minPrice}
              onChange={(e) => onFilterChange('minPrice', e.target.value)}
              className="field-input min-w-0 px-3 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label={t('home.price_max')}
              placeholder={t('home.price_max')}
              value={filters.maxPrice}
              onChange={(e) => onFilterChange('maxPrice', e.target.value)}
              aria-invalid={invalidRange}
              aria-describedby={invalidRange ? 'coffee-price-error' : undefined}
              className="field-input min-w-0 px-3 text-sm"
            />
          </div>
          {invalidRange && (
            <p id="coffee-price-error" className="mt-2 text-xs text-red-700">
              {t('home.invalid_price_range')}
            </p>
          )}
        </fieldset>
        <div>
          <label
            htmlFor="coffee-grind"
            className="mb-2 block text-xs font-semibold text-[#53634f]"
          >
            {t('home.label_grind_type')}
          </label>
          <select
            id="coffee-grind"
            value={filters.grindType}
            onChange={(e) => onFilterChange('grindType', e.target.value)}
            className="field-input text-sm"
          >
            <option value="">{t('home.option_all_grind_types')}</option>
            <option value="ground">{t('home.option_ground')}</option>
            <option value="whole">{t('home.option_whole')}</option>
          </select>
        </div>
        <button
          onClick={onReset}
          disabled={!activeCount}
          className="w-full border-t border-[#deded3] pt-4 text-xs font-semibold text-[#365440] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('home.button_clear_filters')}
        </button>
      </div>
    </div>
  )
}
