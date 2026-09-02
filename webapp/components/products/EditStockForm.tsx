'use client'

import { useTranslations } from 'next-intl'

import { Product } from '@/services/api/products'
import { useEditProductStock } from '@/hooks/products/useEditProductStock'

interface EditStockFormProps {
  product: Product
  productId: string
  onStockUpdate?: (product: Product) => void
}

export function EditStockForm({
  product,
  productId,
  onStockUpdate,
}: EditStockFormProps) {
  const t = useTranslations()

  const {
    stockValue,
    isUpdatingStock,
    errors,
    showSuccess,
    isBlocked,
    handleStockDecrease,
    handleStockIncrease,
    handleStockUpdate,
  } = useEditProductStock({
    product,
    productId,
    onStockUpdate,
    t,
  })

  return (
    <form onSubmit={handleStockUpdate} className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-6 ${isBlocked ? 'opacity-60' : ''}`}>
      <h2 className="text-xl font-semibold text-black mb-4">
        {t('my_products.edit.update_stock_title')}
      </h2>

      {isBlocked && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">{t('my_products.edit.stock_edit_blocked_message')}</p>
        </div>
      )}

      {showSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{t('my_products.edit.stock_update_success')}</p>
        </div>
      )}

      {errors.stock && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{errors.stock}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          type="button"
          onClick={handleStockDecrease}
          disabled={isBlocked || isUpdatingStock || stockValue <= 0}
          className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -
        </button>
        <div className="min-w-[80px] text-center">
          <span className={`text-2xl font-semibold ${isBlocked ? 'text-gray-500' : 'text-gray-900'}`}>{stockValue}</span>
        </div>
        <button
          type="button"
          onClick={handleStockIncrease}
          disabled={isBlocked || isUpdatingStock}
          className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4 text-center">
        {t('my_products.edit.update_stock_disclaimer')}
      </p>

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={isBlocked || isUpdatingStock}
          className={`px-6 py-2 bg-orange-500 text-white rounded-md transition-colors font-medium ${
            isBlocked || isUpdatingStock
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-orange-600'
          }`}
        >
          {isUpdatingStock ? t('my_products.edit.button_updating_stock') : t('my_products.edit.button_update_stock')}
        </button>
      </div>
    </form>
  )
}

