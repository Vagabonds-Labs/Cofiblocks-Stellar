'use client'

import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useUser } from '@/lib/providers/UserProvider'
import { useEvents } from '@/hooks/events/useEvents'
import { formatEventDateTime } from '@/utils/formatting'
import { CalendarIcon, MapPinIcon, ClockIcon, PlusIcon } from '@heroicons/react/24/outline'

export default function AdminEventsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations()
  const { user, loading: userLoading } = useUser()
  const { events, loading: eventsLoading, error: eventsError } = useEvents()

  if (userLoading || !user) {
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTimezone = (timezone: string) => {
    // Convert IANA timezone to a more readable format
    // e.g., "America/New_York" -> "America/New York"
    return timezone.replace(/_/g, ' ')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin_events.title')}</h1>
            <p className="text-gray-600">{t('admin_events.subtitle')}</p>
          </div>
          <button
            onClick={() => router.push(`/${locale}/admin/events/add`)}
            className="
              flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md
              hover:bg-green-700 transition-colors font-medium
            "
          >
            <PlusIcon className="w-5 h-5" />
            {t('admin_events.button_add_event')}
          </button>
        </div>

        {/* Error message */}
        {eventsError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {eventsError}
          </div>
        )}

        {/* Events list */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {eventsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('admin_events.loading_events')}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('admin_events.no_events')}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((event) => (
                <div 
                  key={event.id} 
                  onClick={() => router.push(`/${locale}/admin/events/${event.id}`)}
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {event.title}
                      </h3>
                      
                      {event.description && (
                        <p className="text-gray-600 mb-4">{event.description}</p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="w-5 h-5" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5" />
                          <span>
                            {formatEventDateTime(event.startAt, event.endAt, event.timezone, event.isAllDay)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-5 h-5" />
                          <span>
                            {formatTimezone(event.timezone)}
                          </span>
                        </div>

                        {event.isAllDay && (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">
                              {t('admin_events.add.label_all_day')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" />
                        <span>{t('admin_events.created')} {formatDateTime(event.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" />
                        <span>{t('admin_events.updated')} {formatDateTime(event.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

