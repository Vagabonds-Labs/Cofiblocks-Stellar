'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { farmService } from '@/services/api/farms'

export default function AddFarmPage() {
  const t = useTranslations()
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    country: 'Costa Rica',
    altitude: '',
    coordinates: '',
    website: '',
    logo: null as File | null,
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Cleanup previous preview if exists
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }

      // Validate image dimensions
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      
      img.onload = () => {
        const MAX_WIDTH = 300
        const MAX_HEIGHT = 300
        
        if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
          setErrors((prev) => ({
            ...prev,
            logo: t('my_products.add_farm.error_logo_dimensions', {
              width: img.width,
              height: img.height,
              maxWidth: MAX_WIDTH,
              maxHeight: MAX_HEIGHT,
            }),
          }))
          // Clear the file input and preview
          e.target.value = ''
          setFormData((prev) => ({ ...prev, logo: null }))
          setLogoPreview(null)
          URL.revokeObjectURL(objectUrl)
          return
        }
        
        // Clear any previous errors
        if (errors.logo) {
          setErrors((prev) => {
            const newErrors = { ...prev }
            delete newErrors.logo
            return newErrors
          })
        }
        
        // Set the file and create preview
        setFormData((prev) => ({
          ...prev,
          logo: file,
        }))
        
        setLogoPreview(objectUrl)
      }
      
      img.onerror = () => {
        setErrors((prev) => ({
          ...prev,
          logo: t('my_products.add_farm.error_logo_invalid'),
        }))
        e.target.value = ''
        setFormData((prev) => ({ ...prev, logo: null }))
        setLogoPreview(null)
        URL.revokeObjectURL(objectUrl)
      }
      
      img.src = objectUrl
    } else {
      // If no file selected, clear preview
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
      setLogoPreview(null)
      setFormData((prev) => ({ ...prev, logo: null }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = t('my_products.add_farm.error_name_required')
    }

    if (!formData.region.trim()) {
      newErrors.region = t('my_products.add_farm.error_region_required')
    }

    if (!formData.country) {
      newErrors.country = t('my_products.add_farm.error_country_required')
    }

    if (!formData.altitude) {
      newErrors.altitude = t('my_products.add_farm.error_altitude_required')
    } else {
      const altitudeNum = parseInt(formData.altitude, 10)
      if (isNaN(altitudeNum) || altitudeNum < 0) {
        newErrors.altitude = t('my_products.add_farm.error_altitude_invalid')
      }
    }

    if (!formData.coordinates.trim()) {
      newErrors.coordinates = t('my_products.add_farm.error_coordinates_required')
    }

    if (formData.website && formData.website.trim()) {
      try {
        new URL(formData.website)
      } catch {
        newErrors.website = t('my_products.add_farm.error_website_invalid')
      }
    }

    // Validate logo dimensions if provided
    if (formData.logo) {
      // This validation is already done in handleLogoChange, but we check again here
      // to ensure the error state is still valid
      if (errors.logo) {
        newErrors.logo = errors.logo
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Build farm data object
      const farmData = {
        name: formData.name.trim(),
        sales: 0,
        region: formData.region.trim(),
        country: formData.country,
        altitude: parseInt(formData.altitude, 10),
        coordinates: formData.coordinates.trim(),
        website: formData.website.trim() || undefined,
      }
      console.log(farmData)

      // Pass the logo file if uploaded
      await farmService.createFarm(farmData, formData.logo || undefined)
      
      // Redirect back to my-products page
      router.push('/seller/my-farms')
    } catch (error) {
      console.error('Failed to create farm:', error)
      setErrors({
        general: error instanceof Error ? error.message : t('my_products.add_farm.error_general'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push('/seller/my-farms')
  }

  return (
    <div className="min-h-screen bg-white">
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with back button */}
        <div className="mb-8">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            {t('my_products.add_farm.button_back')}
          </button>
          <h1 className="text-3xl font-bold text-black">
            {t('my_products.add_farm.title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('my_products.add_farm.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Farm Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add_farm.label_name')}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Region */}
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add_farm.label_region')}
              </label>
              <input
                type="text"
                id="region"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
                  errors.region ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.region && (
                <p className="mt-1 text-sm text-red-600">{errors.region}</p>
              )}
            </div>

            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add_farm.label_country')}
              </label>
              <select
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
                  errors.country ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="Costa Rica">Costa Rica</option>
              </select>
              {errors.country && (
                <p className="mt-1 text-sm text-red-600">{errors.country}</p>
              )}
            </div>

            {/* Altitude */}
            <div>
              <label htmlFor="altitude" className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add_farm.label_altitude')}
              </label>
              <input
                type="number"
                id="altitude"
                name="altitude"
                value={formData.altitude}
                onChange={handleInputChange}
                min="0"
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
                  errors.altitude ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              <p className="mt-1 text-sm text-gray-500">{t('my_products.add_farm.altitude_hint')}</p>
              {errors.altitude && (
                <p className="mt-1 text-sm text-red-600">{errors.altitude}</p>
              )}
            </div>

            {/* Coordinates */}
            <div>
              <label htmlFor="coordinates" className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add_farm.label_coordinates')}
              </label>
              <input
                type="text"
                id="coordinates"
                name="coordinates"
                value={formData.coordinates}
                onChange={handleInputChange}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
                  errors.coordinates ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.coordinates && (
                <p className="mt-1 text-sm text-red-600">{errors.coordinates}</p>
              )}
            </div>

            {/* Website */}
            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add_farm.label_website')}
                <span className="text-gray-500 ml-1">({t('my_products.add_farm.optional')})</span>
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="https://example.com"
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
                  errors.website ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.website && (
                <p className="mt-1 text-sm text-red-600">{errors.website}</p>
              )}
            </div>

            {/* Logo Upload */}
            <div>
              <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-2">
                {t('my_products.add_farm.label_logo')}
                <span className="text-gray-500 ml-1">({t('my_products.add_farm.optional')})</span>
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {logoPreview ? (
                    <div className="mt-2">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="mx-auto h-32 w-32 object-cover rounded-md"
                      />
                    </div>
                  ) : (
                    <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  )}
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="logo"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-orange-600 hover:text-orange-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-orange-500"
                    >
                      <span>{t('my_products.add_farm.button_upload_logo')}</span>
                      <input
                        id="logo"
                        name="logo"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleLogoChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
              </div>
              {errors.logo && (
                <p className="mt-1 text-sm text-red-600">{errors.logo}</p>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-8 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors font-medium"
              disabled={isSubmitting}
            >
              {t('my_products.add_farm.button_cancel')}
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('my_products.add_farm.button_submitting') : t('my_products.add_farm.button_submit')}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

