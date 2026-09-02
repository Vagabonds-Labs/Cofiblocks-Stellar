'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { eventsService } from '@/services/api/events'

export function useDeleteEvent() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deleteEvent(eventId: string) {
    setDeleting(true)
    setError(null)

    try {
      await eventsService.deleteEvent(eventId)
      // Redirect to events list after successful deletion
      router.push(`/${locale}/admin/events`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event'
      setError(errorMessage)
      throw err
    } finally {
      setDeleting(false)
    }
  }

  return {
    deleteEvent,
    deleting,
    error,
  }
}

