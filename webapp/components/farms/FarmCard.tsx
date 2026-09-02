'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MapPinIcon, GlobeAltIcon, TrashIcon } from '@heroicons/react/24/outline'
import { farmService } from '@/services/api/farms'
import { FarmCardProps } from './types'

export function FarmCard({ farm, onDelete }: FarmCardProps) {
  const t = useTranslations()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await farmService.deleteFarm(farm.id)
      onDelete?.()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete farm')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="
        w-full
        bg-white border border-gray-200 rounded-lg
        px-4 py-3
        hover:bg-gray-50 transition
      "
    >
      {/* GRID on desktop, STACK on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] gap-4 items-center">
        
        {/* ---------- Logo ---------- */}
        <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-100">
          {farm.logoUrl ? (
            <img
              src={farm.logoUrl}
              alt={farm.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <span className="text-gray-500 font-semibold text-lg">
                {farm.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* ---------- Info (grow) ---------- */}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {farm.name}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <MapPinIcon className="w-3.5 h-3.5" />
              <span>
                {farm.region}, {farm.country}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-medium">
                {t('my_products.farm.altitude')}:
              </span>
              <span>{farm.altitude}m</span>
            </div>

            {farm.website && (
              <div className="flex items-center gap-1 min-w-0">
                <GlobeAltIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <a
                  href={farm.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate max-w-[220px]"
                >
                  {farm.website}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Sales (desktop only) ---------- */}
        <div className="hidden sm:flex flex-col items-end text-xs text-gray-600">
          <span>{t('my_products.farm.sales')}</span>
          <span className="text-sm font-semibold text-gray-900">
            {farm.sales}
          </span>
        </div>

        {/* ---------- Actions ---------- */}
        <div className="flex justify-start sm:justify-end">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="
              flex items-center gap-1.5
              px-3 py-1.5
              text-xs font-medium
              text-red-600 border border-red-200 rounded-md
              hover:bg-red-50
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <TrashIcon className="w-3.5 h-3.5" />
            {isDeleting
              ? t('my_products.farm.deleting')
              : t('my_products.farm.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
