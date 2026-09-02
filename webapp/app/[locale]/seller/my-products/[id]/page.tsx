'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

import { productService, Product } from '@/services/api/products'
import { GeneralInformationForm, EditStockForm } from '@/components/products'

export default function EditProductPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'stock'>('general')

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return

      setLoading(true)
      setError(null)

      try {
        const productData = await productService.getProductById(productId)
        setProduct(productData)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load product'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [productId])

  const handleProductUpdate = (updatedProduct: Product) => {
    setProduct(updatedProduct)
  }

  const handleCancel = () => {
    router.push('/seller/my-products')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-600">{t('my_products.edit.loading')}</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-red-600">{error || t('my_products.edit.not_found')}</p>
            <button
              onClick={handleCancel}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors font-medium"
            >
              {t('my_products.edit.button_back')}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header with back button */}
        <div className="mb-8">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            {t('my_products.edit.button_back')}
          </button>
          <h1 className="text-3xl font-bold text-black">
            {t('my_products.edit.title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('my_products.edit.subtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('my_products.edit.tab_general_information')}
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'stock'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('my_products.edit.tab_edit_stock')}
            </button>
          </nav>
        </div>

        {/* General Information Tab */}
        {activeTab === 'general' && product && (
          <GeneralInformationForm
            product={product}
            productId={productId}
            onProductUpdate={handleProductUpdate}
          />
        )}

        {/* Edit Stock Tab */}
        {activeTab === 'stock' && product && (
          <EditStockForm
            product={product}
            productId={productId}
            onStockUpdate={handleProductUpdate}
          />
        )}
      </main>
    </div>
  )
}

