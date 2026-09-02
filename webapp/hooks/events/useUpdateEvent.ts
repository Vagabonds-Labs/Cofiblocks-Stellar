'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { eventsService } from '@/services/api/events'
import { UpdateEventData, Event } from '@/services/api/events/types'

export type EventForm = {
  title: string
  description: string
  location: string
  startDate: string // YYYY-MM-DD format
  startTime: string // HH:mm format
  endDate: string // YYYY-MM-DD format
  endTime: string // HH:mm format
  timezone: string // IANA timezone format
  isAllDay: boolean
}

export function useUpdateEvent(eventId: string, t?: ReturnType<typeof useTranslations>) {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const defaultTranslations = useTranslations()
  const translations = t || defaultTranslations

  // Get browser timezone
  const getBrowserTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'UTC'
    }
  }

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<EventForm>({
    title: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezone: getBrowserTimezone(),
    isAllDay: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [timezones, setTimezones] = useState<string[]>([])
  const [loadingTimezones, setLoadingTimezones] = useState(true)

  // Fetch timezones on mount
  useEffect(() => {
    async function fetchTimezones() {
      try {
        setLoadingTimezones(true)
        const fetchedTimezones = await eventsService.getTimezones()
        setTimezones(fetchedTimezones)
      } catch (error) {
        console.error('Failed to fetch timezones:', error)
        setTimezones([''])
      } finally {
        setLoadingTimezones(false)
      }
    }
    
    fetchTimezones()
  }, [])

  // Load event data
  useEffect(() => {
    const loadEvent = async () => {
      setLoading(true)
      try {
        const eventData = await eventsService.getEventById(eventId)
        setEvent(eventData)
        
        // Parse startAt and endAt from ISO strings (they are in UTC)
        // Convert them to the event's timezone for display
        const startDateUTC = new Date(eventData.startAt)
        const endDateUTC = new Date(eventData.endAt)
        
        // Format dates and times in the event's timezone
        // Use Intl.DateTimeFormat to get the correct local representation
        const startFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: eventData.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        const startTimeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: eventData.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        const endFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: eventData.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        const endTimeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: eventData.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        
        const startDateStr = startFormatter.format(startDateUTC) // YYYY-MM-DD
        const startTimeStr = startTimeFormatter.format(startDateUTC) // HH:mm
        const endDateStr = endFormatter.format(endDateUTC) // YYYY-MM-DD
        const endTimeStr = endTimeFormatter.format(endDateUTC) // HH:mm
        
        setForm({
          title: eventData.title,
          description: eventData.description || '',
          location: eventData.location || '',
          startDate: startDateStr,
          startTime: startTimeStr,
          endDate: endDateStr,
          endTime: endTimeStr,
          timezone: eventData.timezone,
          isAllDay: eventData.isAllDay,
        })
      } catch (err) {
        setErrors({
          general: err instanceof Error ? err.message : translations('admin_events.add.error_general'),
        })
      } finally {
        setLoading(false)
      }
    }

    if (eventId) {
      loadEvent()
    }
  }, [eventId, translations])

  function updateField<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors(prev => {
        const newErr = { ...prev }
        delete newErr[key]
        return newErr
      })
    }
  }

  function handleText(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const value = e.target.type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : e.target.value
    updateField(e.target.name as keyof EventForm, value as EventForm[keyof EventForm])
  }

  function handleCheckbox(e: React.ChangeEvent<HTMLInputElement>) {
    updateField(e.target.name as keyof EventForm, e.target.checked as EventForm[keyof EventForm])
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    updateField(e.target.name as keyof EventForm, e.target.value as EventForm[keyof EventForm])
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!form.title.trim()) {
      newErrors.title = translations('admin_events.add.error_title_required')
    }

    if (!form.location.trim()) {
      newErrors.location = translations('admin_events.add.error_location_required')
    }

    if (!form.startDate) {
      newErrors.startDate = translations('admin_events.add.error_start_date_required')
    }

    if (!form.isAllDay && !form.startTime) {
      newErrors.startTime = translations('admin_events.add.error_start_time_required')
    }

    if (!form.isAllDay && !form.endDate) {
      newErrors.endDate = translations('admin_events.add.error_end_date_required')
    }

    if (!form.isAllDay && !form.endTime) {
      newErrors.endTime = translations('admin_events.add.error_end_time_required')
    }

    // Validate that end date/time is after start date/time (only if not all-day)
    if (!form.isAllDay && form.startDate && form.startTime && form.endDate && form.endTime) {
      const startDateTime = new Date(`${form.startDate}T${form.startTime}`)
      const endDateTime = new Date(`${form.endDate}T${form.endTime}`)
      
      if (endDateTime <= startDateTime) {
        newErrors.endDate = translations('admin_events.add.error_end_before_start')
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Format date and time to ISO string without timezone (will be interpreted in the selected timezone)
  function formatDateTime(date: string, time: string, isAllDay: boolean): string {
    if (isAllDay) {
      // For all-day events, use midnight
      return `${date}T00:00:00`
    }
    return `${date}T${time}:00`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)

    try {
      const startAtISO = formatDateTime(form.startDate, form.startTime, form.isAllDay)
      const endAtISO = form.isAllDay 
        ? undefined 
        : (form.endDate && form.endTime ? formatDateTime(form.endDate, form.endTime, false) : undefined)

      const updateData: UpdateEventData = {
        id: eventId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim(),
        startAt: startAtISO,
        endAt: endAtISO,
        timezone: event?.timezone,
        isAllDay: form.isAllDay,
      }

      console.log('update data', updateData)

      await eventsService.updateEvent(updateData)

      // Redirect to events list
      router.push(`/${locale}/admin/events`)
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : translations('admin_events.edit.error_general'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return {
    event,
    loading,
    form,
    errors,
    submitting,
    timezones,
    loadingTimezones,
    handleText,
    handleCheckbox,
    handleSelect,
    handleSubmit,
    updateField,
  }
}

