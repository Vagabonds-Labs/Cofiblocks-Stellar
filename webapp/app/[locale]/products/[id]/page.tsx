'use client'

import { 
  MapPinIcon, 
  GlobeAltIcon, 
  ShoppingCartIcon,
  ArrowLeftIcon,
  MinusIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import NextImage from 'next/image'

import { productService, Product } from '@/services/api/products'
import { useCart } from '@/lib/stores/cartStore'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const items = useCart(state => state.items)
  const addItem = useCart(state => state.addItem)
  const updateItem = useCart(state => state.updateItem)
  const removeItem = useCart(state => state.removeItem)

  const cartItem = product ? items.find(item => item.productId === product.id) : null
  const quantity = cartItem?.amount ?? 0
  const isInCart = quantity > 0

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return

      setLoading(true)
      setError(null)

      try {
        const response = await productService.getProductById(productId)
        setProduct(response)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load product'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [productId])

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
  }

  const handleAddToCart = () => {
    if (product) {
      addItem(product.id, 1)
    }
  }

  const handleDecrease = () => {
    if (product && quantity > 1) {
      updateItem(product.id, quantity - 1)
    } else if (product && quantity === 1) {
      removeItem(product.id)
    }
  }

  const handleIncrease = () => {
    if (product && quantity < (product.currentStock - product.reservedStock)) {
      updateItem(product.id, quantity + 1)
    } else if (product && quantity >= (product.currentStock - product.reservedStock)) {
      updateItem(product.id, product.currentStock - product.reservedStock)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-600">{t('product_detail.loading')}</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-red-600">{error || t('product_detail.not_found')}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
            >
              {t('product_detail.button_back')}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>{t('product_detail.button_back')}</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Product Image */}
          <div className="aspect-square w-full overflow-hidden bg-gray-100 rounded-lg">
            {product.imageUrl ? (
              <NextImage
                src={product.imageUrl}
                alt={product.title}
                width={800}
                height={800}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                {t('product_detail.no_image')}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold text-black mb-4">{product.title}</h1>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                {product.roastLevel}
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                {product.grindType === 'WHOLE' ? t('home.option_whole') : t('home.option_ground')}
              </span>
            </div>

            <div className="mb-6">
              <p className="text-3xl font-bold text-black mb-2">
                ${product.price.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">
                {t('product_detail.stock')}: {product.currentStock - product.reservedStock}
              </p>
            </div>

            {product.description && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-black mb-2">
                  {t('product_detail.description')}
                </h2>
                <p className="text-gray-700 leading-relaxed">{product.description}</p>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-black mb-2">
                {t('product_detail.product_info')}
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('product_detail.created_at')}:</span>
                  <span className="text-black">{formatDate(product.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('product_detail.sales')}:</span>
                  <span className="text-black">{product.sales}</span>
                </div>
              </div>
            </div>

            {!isInCart ? (
              <button
                onClick={handleAddToCart}
                disabled={!product || ((product.currentStock - product.reservedStock) === 0)}
                className="
                  w-full flex items-center justify-center gap-2 
                  bg-orange-500 hover:bg-orange-600 text-white 
                  text-lg font-medium py-3 px-6 rounded-md 
                  transition-colors mt-auto
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <ShoppingCartIcon className="w-6 h-6" />
                {product && (product.currentStock - product.reservedStock) === 0 
                  ? t('product_detail.out_of_stock') 
                  : t('product_detail.button_add_to_cart')}
              </button>
            ) : (
              <div className="
                w-full flex items-center justify-center gap-4 
                bg-orange-500 text-white 
                text-lg font-medium py-3 px-6 rounded-md 
                mt-auto
              ">
                <button
                  onClick={handleDecrease}
                  className="flex items-center justify-center w-8 h-8 rounded hover:bg-white/20 transition-colors"
                >
                  <MinusIcon className="w-5 h-5" />
                </button>
                <span className="min-w-[3rem] text-center font-semibold text-xl">{quantity}</span>
                <button
                  onClick={handleIncrease}
                  className="flex items-center justify-center w-8 h-8 rounded hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!product || quantity >= product.currentStock}
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Farm Details Section */}
        <div className="border-t border-gray-200 pt-8">
          <h2 className="text-3xl font-bold text-black mb-6">
            {t('product_detail.farm_info')}
          </h2>
          
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-start gap-6">
              {/* Farm Logo */}
              {product.farm.logoUrl && (
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-white border-2 border-gray-200">
                    <NextImage
                      src={product.farm.logoUrl}
                      alt={product.farm.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Farm Details */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-black mb-4">{product.farm.name}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-start gap-2">
                    <MapPinIcon className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600">{t('product_detail.farm_region')}</p>
                      <p className="text-black font-medium">{product.farm.region}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">{t('product_detail.farm_country')}</p>
                    <p className="text-black font-medium">{product.farm.country}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">{t('product_detail.farm_altitude')}</p>
                    <p className="text-black font-medium">{product.farm.altitude} m</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">{t('product_detail.farm_coordinates')}</p>
                    <p className="text-black font-medium font-mono text-sm">{product.farm.coordinates}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  {product.farm.website && (
                    <a
                      href={product.farm.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      <GlobeAltIcon className="w-5 h-5" />
                      <span>{t('product_detail.farm_website')}</span>
                    </a>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{t('product_detail.farm_sales')}:</span>
                    <span className="text-black font-semibold">{product.farm.sales}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
