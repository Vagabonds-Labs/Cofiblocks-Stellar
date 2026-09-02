'use client'

import { useState, useEffect } from 'react'
import { ArrowLeftIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { useProductForm } from '@/hooks/products/useProductForm'
import { useUser } from '@/lib/providers/UserProvider'
import { farmService, Farm } from '@/services/api/farms'

export default function AddProductPage() {
  const t = useTranslations()
  const router = useRouter()
  const { user } = useUser()

  const [farms, setFarms] = useState<Farm[]>([])
  const [farmsLoading, setFarmsLoading] = useState(true)
  const [farmsError, setFarmsError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFarms = async () => {
      if (!user) {
        setFarmsLoading(false)
        return
      }

      setFarmsLoading(true)
      setFarmsError(null)

      try {
        if (user.sellerType === 'ROASTER') {
          // ROASTER: Get all farms
          const response = await farmService.getAllFarms()
          setFarms(response || [])
        } else if (user.sellerType === 'PRODUCER') {
          // PRODUCER: Get only their farms
          const response = await farmService.getMyFarms()
          setFarms(response || [])
        } else {
          setFarms([])
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred'
        setFarmsError(errorMessage)
      } finally {
        setFarmsLoading(false)
      }
    }

    fetchFarms()
  }, [user])

  const {
    form,
    errors,
    imagePreview,
    submitting,

    handleText,
    handleSelect,
    handleNumber,
    handleImageChange,
    handleSubmit,
  } = useProductForm(t, router)

  const roastLevels = ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark']

  const grindTypes = [
    { value: 'WHOLE', label: t('my_products.add.option_whole') },
    { value: 'GROUND', label: t('my_products.add.option_ground') },
  ]

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/seller/my-products')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            {t('my_products.add.button_back')}
          </button>

          <h1 className="text-3xl font-bold text-black">
            {t('my_products.add.title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('my_products.add.subtitle')}
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">

          {/* GENERAL ERROR */}
          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <div className="space-y-6">

            {/* TITLE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add.label_title')}
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleText}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add.label_description')}
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleText}
                rows={4}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* ROAST LEVEL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add.label_roast_level')}
              </label>
              <select
                name="roastLevel"
                value={form.roastLevel}
                onChange={handleSelect}
                className={`block w-full px-3 py-2 border rounded-md ${
                  errors.roastLevel ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">{t('my_products.add.option_select_roast_level')}</option>
                {roastLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              {errors.roastLevel && <p className="mt-1 text-sm text-red-600">{errors.roastLevel}</p>}
            </div>

            {/* GRIND TYPE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add.label_grind_type')}
              </label>
              <select
                name="grindType"
                value={form.grindType}
                onChange={handleSelect}
                className={`block w-full px-3 py-2 border rounded-md ${
                  errors.grindType ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">{t('my_products.add.option_select_grind_type')}</option>
                {grindTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {errors.grindType && <p className="mt-1 text-sm text-red-600">{errors.grindType}</p>}
            </div>

            {/* PRICE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add.label_price')}
              </label>
              <input
                type="number"
                name="price"
                value={form.price ?? ''}
                onChange={handleNumber}
                step="0.01"
                min="0"
                className={`block w-full px-3 py-2 border rounded-md ${
                  errors.price ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
            </div>

            {/* STOCK */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add.label_stock')}
              </label>
              <input
                type="number"
                name="stock"
                value={form.stock ?? ''}
                onChange={handleNumber}
                min="0"
                className={`block w-full px-3 py-2 border rounded-md ${
                  errors.stock ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.stock && <p className="mt-1 text-sm text-red-600">{errors.stock}</p>}
            </div>

            {/* IMAGE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add.label_image')}
              </label>

              <div className="border-2 border-gray-300 border-dashed rounded-md p-6 text-center">
                {imagePreview ? (
                  <img src={imagePreview} className="mx-auto h-48 w-48 object-cover rounded-md" />
                ) : (
                  <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                )}

                <label className="mt-3 inline-block cursor-pointer text-orange-600 font-medium">
                  {t('my_products.add.button_upload_image')}
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageChange}
                  />
                </label>

                <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
              </div>

              {errors.image && <p className="mt-1 text-sm text-red-600">{errors.image}</p>}
            </div>

            {/* FARM SELECT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add.label_farm')}
              </label>

              <select
                name="farmId"
                value={form.farmId}
                onChange={handleSelect}
                disabled={farmsLoading}
                className={`block w-full px-3 py-2 border rounded-md ${
                  errors.farmId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">{t('my_products.add.option_select_farm')}</option>
                {farms.map(farm => (
                  <option key={farm.id} value={farm.id}>{farm.name}</option>
                ))}
              </select>

              {farmsLoading && <p className="mt-1 text-sm text-gray-500">{t('my_products.add.loading_farms')}</p>}
              {farmsError && <p className="mt-1 text-sm text-red-600">{farmsError}</p>}
              {errors.farmId && <p className="mt-1 text-sm text-red-600">{errors.farmId}</p>}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="mt-8 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push('/seller/my-products')}
              className="px-6 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
            >
              {t('my_products.add.button_cancel')}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? t('my_products.add.button_submitting') : t('my_products.add.button_submit')}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
