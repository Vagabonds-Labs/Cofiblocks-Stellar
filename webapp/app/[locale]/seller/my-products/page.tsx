'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { PlusIcon } from '@heroicons/react/24/outline'

import { useMyProducts } from '@/hooks/products/useMyProducts'
import { useUser } from '@/lib/providers/UserProvider'
import { StatusTabs } from '@/components/products/StatusTabs'
import { MyProductRow } from '@/components/products/MyProductRow'

type ProductStatus = 'CREATION_REQUEST' | 'PUBLISHED' | 'HIDDEN'

export default function MyProductsPage() {
  const t = useTranslations()
  const router = useRouter()
  const { user } = useUser()

  const [activeStatus, setActiveStatus] =
    useState<ProductStatus>('CREATION_REQUEST')

  const {
    products,
    loading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useMyProducts()

  const productsByStatus = useMemo(() => {
    const map: Record<ProductStatus, any[]> = {
      CREATION_REQUEST: [],
      PUBLISHED: [],
      HIDDEN: [],
    }

    products.forEach(p => {
      map[p.status as ProductStatus]?.push(p)
    })

    return map
  }, [products])

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* ===== Header ===== */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">
            {t('my_products.title')}
          </h1>

          <button
            onClick={() => router.push('/seller/my-products/add')}
            className="
              hidden md:flex items-center gap-2
              px-4 py-2 rounded-md
              bg-orange-500 text-white
              hover:bg-orange-600 transition
            "
          >
            <PlusIcon className="w-5 h-5" />
            {t('my_products.button_add_product')}
          </button>
        </div>

        {/* ===== Tabs ===== */}
        <StatusTabs
          active={activeStatus}
          onChange={setActiveStatus}
          counts={{
            CREATION_REQUEST: productsByStatus.CREATION_REQUEST.length,
            PUBLISHED: productsByStatus.PUBLISHED.length,
            HIDDEN: productsByStatus.HIDDEN.length,
          }}
          t={t}
        />

        {/* ===== Disclaimer ===== */}
        { activeStatus === 'CREATION_REQUEST' && productsByStatus.CREATION_REQUEST.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              {t('my_products.disclaimer_not_onchain')}
            </p>
          </div>
        )}

        {/* ===== Content ===== */}
        <section className="mt-6">
          {productsLoading && (
            <p className="py-12 text-center text-gray-500">
              {t('my_products.loading')}
            </p>
          )}

          {productsError && (
            <p className="py-12 text-center text-red-500">
              {t('my_products.error_loading')}
            </p>
          )}

          {!productsLoading &&
            !productsError &&
            productsByStatus[activeStatus].length === 0 && (
              <p className="py-12 text-center text-gray-500">
                {t('my_products.no_products')}
              </p>
            )}

          <div className="space-y-3">
            {productsByStatus[activeStatus].map(product => (
              <MyProductRow
                key={product.id}
                product={product}
                onDeploySuccess={refetchProducts}
              />
            ))}
          </div>
        </section>
      </main>

      {/* ===== Mobile FAB ===== */}
      <button
        onClick={() => router.push('/seller/my-products/add')}
        className="
          fixed bottom-6 right-6 md:hidden
          w-14 h-14 rounded-full
          bg-orange-500 text-white
          flex items-center justify-center
          shadow-lg
        "
      >
        <PlusIcon className="w-6 h-6" />
      </button>
    </div>
  )
}
