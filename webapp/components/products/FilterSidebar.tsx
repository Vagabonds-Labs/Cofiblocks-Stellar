'use client'

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { FilterSidebarProps } from './types'


export function FilterSidebar({
  filters,
  onFilterChange,
  uniqueRegions,
  uniqueRoastLevels,
}: FilterSidebarProps) {
  const t = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[rgb(24,33,29)]">{t('home.title_filters')}</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="tablet:hidden btn-secondary px-2.5 py-2 -mr-1"
          aria-label={isExpanded ? t('home.collapse_filters') : t('home.expand_filters')}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className={`${isExpanded ? 'block' : 'hidden'} tablet:block`}>
        {/* Region Filter */}
        <div className="mb-6">
        <label className="block text-sm font-medium text-[rgb(24,33,29)] mb-2">
          {t('home.label_region')}
        </label>
        <select
          value={filters.region}
          onChange={(e) => onFilterChange('region', e.target.value)}
          className="field-input"
        >
          <option value="">{t('home.option_all_regions')}</option>
          {uniqueRegions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>

      {/* Roast Level Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[rgb(24,33,29)] mb-2">
          {t('home.label_roast_level')}
        </label>
        <select
          value={filters.roastLevel}
          onChange={(e) => onFilterChange('roastLevel', e.target.value)}
          className="field-input"
        >
          <option value="">{t('home.option_all_roast_levels')}</option>
          {uniqueRoastLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[rgb(24,33,29)] mb-2">
          {t('home.label_price_range')}
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder={t('home.price_min')}
            value={filters.minPrice}
            onChange={(e) => onFilterChange('minPrice', e.target.value)}
            className="field-input"
          />
          <input
            type="number"
            placeholder={t('home.price_max')}
            value={filters.maxPrice}
            onChange={(e) => onFilterChange('maxPrice', e.target.value)}
            className="field-input"
          />
        </div>
      </div>

      {/* Grind Type Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[rgb(24,33,29)] mb-2">
          {t('home.label_grind_type')}
        </label>
        <select
          value={filters.grindType}
          onChange={(e) => onFilterChange('grindType', e.target.value)}
          className="field-input"
        >
          <option value="">{t('home.option_all_grind_types')}</option>
          <option value="ground">{t('home.option_ground')}</option>
          <option value="whole">{t('home.option_whole')}</option>
        </select>
      </div>

        {/* Clear Filters Button */}
        <button
          onClick={() => {
            onFilterChange('region', '')
            onFilterChange('roastLevel', '')
            onFilterChange('minPrice', '')
            onFilterChange('maxPrice', '')
            onFilterChange('grindType', '')
          }}
          className="btn-secondary w-full"
        >
          {t('home.button_clear_filters')}
        </button>
      </div>
    </div>
  )
}
