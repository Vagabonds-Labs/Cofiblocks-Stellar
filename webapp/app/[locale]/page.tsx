'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import {
  ArrowRightIcon,
  MapPinIcon,
  SparklesIcon,
  SunIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

import { ProductCard, FilterSidebar } from '@/components/products'
import { SearchBar } from '@/components/ui/SearchBar'
import { useProducts, useProductFilters } from '@/hooks'

export default function Home() {
  const t = useTranslations()
  const { filters, updateFilter, updateSearch, resetFilters } =
    useProductFilters()
  const { products, loading, error, uniqueRegions, uniqueRoastLevels, retry } =
    useProducts(filters)
  const [sort, setSort] = useState('default')
  const hasFilters = Object.values(filters).some(Boolean)
  const sortedProducts = useMemo(() => {
    const list = [...products]
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price)
    return list
  }, [products, sort])

  return (
    <main className="marketplace-page bg-[#faf8f4] pb-16">
      <div className="app-container pt-6 md:pt-8">
        <section
          className="grid overflow-hidden rounded-3xl bg-[#eee8dc] md:grid-cols-[1.05fr_1fr]"
          aria-labelledby="marketplace-title"
        >
          <div className="flex flex-col justify-center px-6 py-8 sm:p-10 lg:px-12 lg:py-12">
            <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#38604b]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#38604b]" />
              {t('home.eyebrow')}
            </p>
            <h1
              id="marketplace-title"
              className="max-w-lg font-serif text-[2.65rem] leading-[1.08] tracking-tight text-[#243c2e] sm:text-5xl lg:text-6xl"
            >
              {t('home.title_marketplace')}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#62665b] sm:text-base">
              {t('home.subtitle_marketplace')}
            </p>
            <a
              href="#coffee-catalog"
              className="mt-7 inline-flex w-fit items-center gap-4 rounded-full bg-[#284e3b] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1c392b]"
            >
              {t('home.explore_coffees')}
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="relative min-h-[220px] md:min-h-[380px]">
            <Image
              src="/images/coffee-ritual.webp"
              alt={t('home.hero_image_alt')}
              fill
              priority
              sizes="(max-width: 767px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/50 bg-[#faf8f4]/95 px-4 py-3 text-[#284e3b] md:bottom-7 md:left-7 md:right-auto">
              <SunIcon className="h-8 w-8 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{t('home.hero_note')}</p>
                <p className="mt-0.5 text-xs text-[#62665b]">
                  {t('home.hero_note_detail')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 border-b border-[#e3dfd5] py-6 sm:grid-cols-3 sm:gap-6 md:py-7">
          {(
            [
              [MapPinIcon, 'origin_title', 'origin_description'],
              [SparklesIcon, 'choice_title', 'choice_description'],
              [SunIcon, 'ritual_title', 'ritual_description'],
            ] as const
          ).map(([Icon, title, description]) => (
            <div
              key={title}
              className="flex items-center gap-3 sm:justify-center"
            >
              <Icon
                className="h-5 w-5 shrink-0 text-[#59705a]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-[#304335]">
                  {t(`home.${title}`)}
                </p>
                <p className="mt-0.5 text-xs text-[#6c7267]">
                  {t(`home.${description}`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <section
          id="coffee-catalog"
          className="scroll-mt-28 pt-9 md:pt-11"
          aria-labelledby="catalog-title"
        >
          <div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#74816d]">
                {t('home.catalog_eyebrow')}
              </p>
              <h2
                id="catalog-title"
                className="font-serif text-3xl tracking-tight text-[#243c2e] md:text-4xl"
              >
                {t('home.catalog_title')}
              </h2>
            </div>
            <div className="w-full md:max-w-sm">
              <SearchBar
                value={filters.search}
                onChange={updateSearch}
                placeholder={t('home.placeholder_search')}
              />
            </div>
          </div>

          <div
            className="mb-7 flex flex-wrap gap-2"
            role="group"
            aria-label={t('home.label_grind_type')}
          >
            {[
              ['', 'all_coffees'],
              ['whole', 'option_whole'],
              ['ground', 'option_ground'],
            ].map(([value, label]) => (
              <button
                key={label}
                onClick={() => updateFilter('grindType', value)}
                aria-pressed={filters.grindType === value}
                className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${filters.grindType === value ? 'border-[#284e3b] bg-[#284e3b] text-white' : 'border-[#deded3] bg-transparent text-[#5a665a] hover:border-[#284e3b] hover:bg-[#f0eee7]'}`}
              >
                {t(`home.${label}`)}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            <aside className="shrink-0 lg:w-56">
              <FilterSidebar
                filters={filters}
                onFilterChange={updateFilter}
                onReset={resetFilters}
                uniqueRegions={uniqueRegions}
                uniqueRoastLevels={uniqueRoastLevels}
              />
            </aside>
            <div className="min-w-0 flex-1">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p
                  className="text-sm text-[#6c7267]"
                  role="status"
                  aria-live="polite"
                >
                  {loading
                    ? t('home.loading_products')
                    : error
                      ? t('home.catalog_title')
                      : t('home.results_count', { count: products.length })}
                </p>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="coffee-sort"
                    className="text-xs text-[#6c7267]"
                  >
                    {t('home.sort_label')}
                  </label>
                  <select
                    id="coffee-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="rounded-lg border border-[#deded3] bg-white px-2 py-2 text-xs font-medium text-[#304335]"
                  >
                    <option value="default">{t('home.sort_default')}</option>
                    <option value="price-asc">
                      {t('home.sort_price_asc')}
                    </option>
                    <option value="price-desc">
                      {t('home.sort_price_desc')}
                    </option>
                  </select>
                </div>
              </div>
              {hasFilters && (
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  {Object.entries(filters)
                    .filter(([, value]) => value)
                    .map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() =>
                          updateFilter(key as keyof typeof filters, '')
                        }
                        className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#e9eee6] px-3 py-1.5 text-xs text-[#365440]"
                        aria-label={t('home.remove_filter', { value })}
                      >
                        <span className="truncate">
                          {key === 'grindType'
                            ? t(
                                value === 'whole'
                                  ? 'home.option_whole'
                                  : 'home.option_ground'
                              )
                            : key === 'minPrice'
                              ? `${t('home.price_min')}: $${value}`
                              : key === 'maxPrice'
                                ? `${t('home.price_max')}: $${value}`
                                : value}
                        </span>
                        <XMarkIcon
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  <button
                    onClick={resetFilters}
                    className="px-2 py-1.5 text-xs font-semibold text-[#365440] underline underline-offset-4"
                  >
                    {t('home.button_clear_filters')}
                  </button>
                </div>
              )}
              <div aria-busy={loading}>
                {loading && (
                  <div
                    className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 6 }, (_, i) => (
                      <div
                        key={i}
                        className="overflow-hidden rounded-2xl border border-[#e5e3d9] bg-white"
                      >
                        <div className="aspect-[4/3] animate-pulse bg-[#eae7df]" />
                        <div className="space-y-3 p-5">
                          <div className="h-4 w-2/3 animate-pulse rounded bg-[#eae7df]" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-[#eae7df]" />
                          <div className="h-10 animate-pulse rounded-xl bg-[#eae7df]" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!loading && error && (
                  <div className="catalog-message" role="alert">
                    <ArrowPathIcon
                      className="mx-auto mb-4 h-8 w-8 text-[#74816d]"
                      aria-hidden="true"
                    />
                    <h3 className="font-semibold">
                      {t('home.error_loading_products')}
                    </h3>
                    <p className="mt-2 text-sm text-[#6c7267]">
                      {t('home.error_try_again')}
                    </p>
                    <button onClick={retry} className="btn-primary mt-5">
                      {t('home.retry')}
                    </button>
                  </div>
                )}
                {!loading && !error && products.length === 0 && (
                  <div className="catalog-message">
                    <MagnifyingGlassIcon
                      className="mx-auto mb-4 h-8 w-8 text-[#74816d]"
                      aria-hidden="true"
                    />
                    <h3 className="font-semibold">
                      {t(
                        hasFilters
                          ? 'home.no_products_title'
                          : 'home.empty_catalog_title'
                      )}
                    </h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-[#6c7267]">
                      {t(
                        hasFilters
                          ? 'home.no_products_found'
                          : 'home.empty_catalog_description'
                      )}
                    </p>
                    {hasFilters && (
                      <button
                        onClick={resetFilters}
                        className="btn-primary mt-5"
                      >
                        {t('home.button_clear_filters')}
                      </button>
                    )}
                  </div>
                )}
                {!loading && !error && products.length > 0 && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {sortedProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
