'use client'

import { useRouter } from 'next/navigation'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { useFarms } from '@/hooks/farms/useFarms'
import { MyFarmRow } from '@/components/farms/MyFarmRow'

export default function MyFarmsPage() {
  const t = useTranslations()
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    farms,
    loading,
    error,
    refetch,
  } = useFarms()

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* ===== Header ===== */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">
            {t('my_farms.title')}
          </h1>

          <button
            onClick={() => router.push('/seller/my-farms/add-farm')}
            className="
              flex items-center gap-2
              px-4 py-2 rounded-md
              bg-orange-500 text-white
              hover:bg-orange-600 transition
            "
          >
            <PlusIcon className="w-5 h-5" />
            {t('my_farms.add_farm') ?? 'Add farm'}
          </button>
        </div>

        {/* ===== Error Message ===== */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between">
            <p className="text-sm text-red-800 flex-1">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-4 text-red-600 hover:text-red-800"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ===== Content ===== */}
        {loading && (
          <p className="py-12 text-center text-gray-500">
            {t('common.loading') ?? 'Loading…'}
          </p>
        )}

        {error && (
          <p className="py-12 text-center text-red-500">
            {error}
          </p>
        )}

        {!loading && !error && farms.length === 0 && (
          <p className="py-12 text-center text-gray-500">
            {t('my_farms.no_farms') ?? 'You have no farms yet'}
          </p>
        )}

        {!loading && !error && farms.length > 0 && (
          <div className="space-y-3">
            {farms.map(farm => (
              <MyFarmRow
                key={farm.id}
                farm={farm}
                onDeleted={refetch}
                onError={(message) => setErrorMessage(message)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
