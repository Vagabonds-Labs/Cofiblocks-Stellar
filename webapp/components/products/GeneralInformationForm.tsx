'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PhotoIcon, TrashIcon } from '@heroicons/react/24/outline'

import { productService, Product, ProductStatus } from '@/services/api/products'
import { ApiError } from '@/lib/api/types'

interface GeneralInformationFormProps {
  product: Product
  productId: string
  onProductUpdate?: (product: Product) => void
}

export function GeneralInformationForm({
  product,
  productId,
  onProductUpdate,
}: GeneralInformationFormProps) {
  const t = useTranslations()
  const router = useRouter()

  const [formData, setFormData] = useState({
    title: product.title,
    description: product.description || '',
    status: product.status as ProductStatus,
    image: null as File | null,
  })
  const [imagePreview, setImagePreview] = useState<string | null>(product.imageUrl || null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error and success message when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    setShowSuccess(false)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }))
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      
      // Clear error and success message for image field
      if (errors.image) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.image
          return newErrors
        })
      }
      setShowSuccess(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = t('my_products.edit.error_title_required')
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
    setErrors({})
    setShowSuccess(false)

    try {
      // Only include status if it can be changed (product is PUBLISHED or HIDDEN)
      const canChangeStatus = product.status === 'PUBLISHED' || product.status === 'HIDDEN'
      
      const updateData: {
        title: string
        description?: string
        status?: ProductStatus
      } = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
      }

      // Only include status if it can be changed
      if (canChangeStatus) {
        updateData.status = formData.status as ProductStatus
      }

      const response = await productService.updateProduct(productId, updateData, formData.image || undefined)
      
      // Notify parent of update if callback provided
      if (onProductUpdate && response.id) {
        onProductUpdate(response)
      }

      // Update form data with the response
      if (response.id) {
        setFormData({
          title: response.title,
          description: response.description || '',
          status: response.status as ProductStatus,
          image: null,
        })
        if (response.imageUrl) {
          setImagePreview(response.imageUrl)
        }
      }

      // Show success message
      setShowSuccess(true)
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false)
      }, 5000)

    } catch (error) {
      const apiError = error as ApiError;
      setErrors({
        general: t(`api_errors.${apiError.code}`),
      })
      setShowSuccess(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }

    setIsDeleting(true)
    setErrors({})

    try {
      await productService.deleteProduct(productId)
      
      // Redirect back to my-products page on success
      router.push('/seller/my-products')
    } catch (error) {
      const apiError = error as ApiError;
      setErrors({
        general: t(`api_errors.${apiError.code}`),
      })
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    router.push('/seller/my-products')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-6">
      {showSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{t('my_products.edit.product_update_success')}</p>
        </div>
      )}

      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{errors.general}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Product Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            {t('my_products.edit.label_title')}
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
              errors.title ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            {t('my_products.edit.label_description')}
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            {t('my_products.edit.label_status')}
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            disabled={product.status !== 'PUBLISHED' && product.status !== 'HIDDEN'}
            className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 ${
              product.status !== 'PUBLISHED' && product.status !== 'HIDDEN'
                ? 'bg-gray-100 cursor-not-allowed opacity-60'
                : ''
            }`}
          >
            {
              product.status === 'CREATION_REQUEST' && (
                <option value="CREATION_REQUEST">{t('my_products.edit.status_creation_request')}</option>
              )
            }
            <option value="PUBLISHED">{t('my_products.edit.status_published')}</option>
            <option value="HIDDEN">{t('my_products.edit.status_hidden')}</option>
          </select>
          {product.status !== 'PUBLISHED' && product.status !== 'HIDDEN' && (
            <p className="mt-1 text-sm text-gray-500">
              {t('my_products.edit.status_disabled_message')}
            </p>
          )}
        </div>

        {/* Image Upload */}
        <div>
          <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-2">
            {t('my_products.edit.label_image')}
          </label>
          <div className="mt-1 flex justify-center px-3 sm:px-6 pt-4 sm:pt-5 pb-4 sm:pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center w-full">
              {imagePreview ? (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="mx-auto h-32 w-32 sm:h-48 sm:w-48 object-cover rounded-md"
                  />
                </div>
              ) : (
                <PhotoIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 text-xs sm:text-sm text-gray-600">
                <label
                  htmlFor="image"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-orange-600 hover:text-orange-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-orange-500"
                >
                  <span>{t('my_products.edit.button_upload_image')}</span>
                  <input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageChange}
                  />
                </label>
                <p className="sm:pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
              {product.imageUrl && !formData.image && (
                <p className="text-xs text-gray-500 mt-2">
                  {t('my_products.edit.current_image')}
                </p>
              )}
            </div>
          </div>
          {errors.image && (
            <p className="mt-1 text-sm text-red-600">{errors.image}</p>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || isSubmitting}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-2 border border-red-300 rounded-md text-red-700 bg-white hover:bg-red-50 transition-colors font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          {showDeleteConfirm 
            ? (isDeleting ? t('my_products.edit.deleting') : t('my_products.edit.confirm_delete'))
            : t('my_products.edit.button_delete')
          }
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 sm:flex-none px-4 py-2 sm:px-6 sm:py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors font-medium text-sm sm:text-base"
          >
            {t('my_products.edit.button_cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isDeleting}
            className={`flex-1 sm:flex-none px-4 py-2 sm:px-6 sm:py-2 bg-orange-500 text-white rounded-md transition-colors font-medium text-sm sm:text-base ${
              isSubmitting || isDeleting
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-orange-600'
            }`}
          >
            {isSubmitting ? t('my_products.edit.button_submitting') : t('my_products.edit.button_submit')}
          </button>
        </div>
      </div>
    </form>
  )
}

