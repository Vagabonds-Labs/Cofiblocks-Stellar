'use client'

import { useTranslations } from 'next-intl'

import { ProductCard, FilterSidebar } from '@/components/products'
import { SearchBar } from '@/components/ui/SearchBar'
import { useProducts, useProductFilters } from '@/hooks'

export default function Home() {
  const t = useTranslations()

  const {
    filters,
    updateFilter,
    updateSearch,
  } = useProductFilters()

  const {
    products,
    loading,
    error,
    uniqueRegions,
    uniqueRoastLevels,
  } = useProducts(filters)

  return (
    <div className="min-h-screen">
      <main className="app-container py-8 md:py-10">

        {/* TITLE + SEARCH */}
        <div className="surface-card p-6 md:p-8 mb-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[rgb(24,33,29)] mb-4 leading-tight max-w-3xl">
            {t('home.title_marketplace')}
          </h2>
          <p className="text-[rgb(90,103,96)] mb-6 max-w-3xl">{t('home.subtitle_marketplace')}</p>
          <p className="text-sm text-[rgb(40,107,86)] font-medium mb-4">{t('home.subtitle_highlight')}</p>

          <div className="max-w-2xl">
            <SearchBar
              value={filters.search}
              onChange={updateSearch}
              placeholder={t('home.placeholder_search')}
            />
          </div>
        </div>

        {/* LAYOUT */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* SIDEBAR */}
          <aside className="lg:w-64 flex-shrink-0">
            <FilterSidebar
              filters={filters}
              onFilterChange={updateFilter}
              uniqueRegions={uniqueRegions}
              uniqueRoastLevels={uniqueRoastLevels}
            />
          </aside>

          {/* PRODUCTS */}
          <section className="flex-1">

            {loading && (
              <div className="surface-card text-center py-12">
                <p className="text-[rgb(90,103,96)]">{t('home.loading_products')}</p>
              </div>
            )}

            {error && (
              <div className="surface-card text-center py-12">
                <p className="text-[rgb(185,52,45)]">{t('home.error_loading_products')}: {error}</p>
                <p className="text-sm text-[rgb(90,103,96)] mt-2">
                  {t('home.error_try_again')}
                </p>
              </div>
            )}

            {!loading && !error && products.length === 0 && (
              <div className="surface-card text-center py-12">
                <p className="text-[rgb(90,103,96)]">
                  {t('home.no_products_found')}
                </p>
              </div>
            )}

            {!loading && !error && products.length > 0 && (
              <div className="
                grid grid-cols-1
                sm:grid-cols-2
                lg:grid-cols-3
                xl:grid-cols-4
                gap-6
              ">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
