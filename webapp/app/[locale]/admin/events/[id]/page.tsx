'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useUser } from '@/lib/providers/UserProvider'
import { useUpdateEvent, useDeleteEvent } from '@/hooks/events'
import { ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline'

export default function EditEventPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const eventId = params.id as string
  const t = useTranslations()
  const { user, loading: userLoading } = useUser()
  const { event, loading: eventLoading, form, errors, submitting, timezones, loadingTimezones, handleText, handleCheckbox, handleSelect, handleSubmit } = useUpdateEvent(eventId, t)
  const { deleteEvent, deleting, error: deleteError } = useDeleteEvent()

  // Check if user is admin and redirect if not
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        router.push(`/${locale}/login?redirect=admin/events/${eventId}`)
        return
      }
      if (!user.isAdmin) {
        router.push(`/${locale}`)
        return
      }
    }
  }, [user, userLoading, router, locale, eventId])

  const handleDelete = async () => {
    if (!confirm(t('admin_events.edit.confirm_delete'))) {
      return
    }

    try {
      await deleteEvent(eventId)
    } catch (err) {
      // Error is handled by the hook
    }
  }

  if (userLoading || !user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('admin_events.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading event...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Event Not Found</h1>
            <p className="text-gray-600 mb-6">The event you&apos;re looking for doesn&apos;t exist or has been deleted.</p>
            <button
              onClick={() => router.push(`/${locale}/admin/events`)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Back to Events
            </button>
          </div>
        </main>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push(`/${locale}/admin/events`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>{t('admin_events.add.button_back')}</span>
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin_events.edit.title')}</h1>

          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {errors.general}
            </div>
          )}

          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {deleteError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin_events.add.label_title')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={form.title}
                onChange={handleText}
                className={`
                  w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500
                  ${errors.title ? 'border-red-500' : 'border-gray-300'}
                `}
                placeholder={t('admin_events.add.placeholder_title')}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin_events.add.label_description')}
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleText}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={t('admin_events.add.placeholder_description')}
              />
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin_events.add.label_location')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={form.location}
                onChange={handleText}
                className={`
                  w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500
                  ${errors.location ? 'border-red-500' : 'border-gray-300'}
                `}
                placeholder={t('admin_events.add.placeholder_location')}
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">{errors.location}</p>
              )}
            </div>

            {/* All Day Checkbox */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAllDay"
                  name="isAllDay"
                  checked={form.isAllDay}
                  onChange={handleCheckbox}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('admin_events.add.label_all_day')}
                </span>
              </label>
            </div>

            {/* Start Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin_events.add.label_start_date')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleText}
                  className={`
                    w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500
                    ${errors.startDate ? 'border-red-500' : 'border-gray-300'}
                  `}
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
                )}
              </div>

              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin_events.add.label_start_time')} {!form.isAllDay && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={form.startTime}
                  onChange={handleText}
                  disabled={form.isAllDay}
                  className={`
                    w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500
                    ${errors.startTime ? 'border-red-500' : 'border-gray-300'}
                    ${form.isAllDay ? 'bg-gray-100 cursor-not-allowed' : ''}
                  `}
                />
                {errors.startTime && (
                  <p className="mt-1 text-sm text-red-600">{errors.startTime}</p>
                )}
              </div>
            </div>

            {/* End Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin_events.add.label_end_date')} {!form.isAllDay && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleText}
                  min={form.startDate || undefined}
                  disabled={form.isAllDay}
                  className={`
                    w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500
                    ${errors.endDate ? 'border-red-500' : 'border-gray-300'}
                    ${form.isAllDay ? 'bg-gray-100 cursor-not-allowed' : ''}
                  `}
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                )}
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin_events.add.label_end_time')} {!form.isAllDay && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleText}
                  disabled={form.isAllDay}
                  className={`
                    w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500
                    ${errors.endTime ? 'border-red-500' : 'border-gray-300'}
                    ${form.isAllDay ? 'bg-gray-100 cursor-not-allowed' : ''}
                  `}
                />
                {errors.endTime && (
                  <p className="mt-1 text-sm text-red-600">{errors.endTime}</p>
                )}
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin_events.add.label_timezone')}
              </label>
              {loadingTimezones ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                  <span className="text-sm text-gray-500">{t('admin_events.add.loading_timezones')}</span>
                </div>
              ) : (
                <select
                  id="timezone"
                  name="timezone"
                  value={form.timezone}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-sm text-gray-500">Timezone cannot be changed after event creation</p>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || submitting}
                className="
                  flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md
                  hover:bg-red-700 transition-colors font-medium
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <TrashIcon className="w-5 h-5" />
                {deleting ? t('admin_events.edit.button_deleting') : t('admin_events.edit.button_delete')}
              </button>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => router.push(`/${locale}/admin/events`)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={submitting || deleting}
                >
                  {t('admin_events.add.button_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || deleting}
                  className="
                    px-4 py-2 bg-green-600 text-white rounded-md
                    hover:bg-green-700 transition-colors font-medium
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {submitting ? t('admin_events.edit.button_submitting') : t('admin_events.edit.button_submit')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

