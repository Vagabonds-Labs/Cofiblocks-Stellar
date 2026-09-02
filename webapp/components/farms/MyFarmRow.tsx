'use client'

import { TrashIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { farmService, Farm } from '@/services/api/farms'
import { useTranslations } from 'next-intl'
import { ApiError } from '@/lib/api/types'

export function MyFarmRow({
  farm,
  onDeleted,
  onError,
}: {
  farm: Farm
  onDeleted: () => void
  onError?: (message: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const t = useTranslations()

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      setDeleting(true)
      await farmService.deleteFarm(farm.id)
      onDeleted()
    } catch (err) {
      const apiError = err as ApiError

      const errorMessage = t(`api_errors.${apiError.code}`)
      
      if (onError) {
        onError(errorMessage ?? 'Failed to delete farm')
      } else {
        alert(errorMessage)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="
        flex items-center gap-4
        p-4 rounded-xl
        border border-gray-200
        bg-white
        hover:bg-gray-50
        transition
      "
    >
      {/* Logo */}
      <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
        {farm.logoUrl ? (
          <img
            src={farm.logoUrl}
            alt={farm.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            {t('my_farms.no_logo')}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {farm.name}
        </p>

        <p className="text-sm text-gray-500">
          {farm.region}, {farm.country}
          {farm.altitude ? ` · ${farm.altitude} m` : ''}
        </p>

        <p className="text-xs text-gray-400 mt-0.5">
          Sales: {farm.sales}
        </p>
      </div>

      {/* Actions */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="
          p-2 rounded-md
          text-gray-400 hover:text-red-600
          hover:bg-red-50
          transition
          disabled:opacity-50
        "
        title="Delete farm"
      >
        <TrashIcon className="w-5 h-5" />
      </button>
    </div>
  )
}
