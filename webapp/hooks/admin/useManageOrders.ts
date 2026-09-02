'use client'

import { useState, useEffect, useCallback } from 'react'
import { adminService } from '@/services/api/admin/service'
import { eventsService } from '@/services/api/events'
import { Order, OrderStatus, DeliveryMethod } from '@/services/api/orders'
import { Event } from '@/services/api/events/types'
import type { User } from '@/services/auth/types'

export interface OrderFilters {
  status: '' | OrderStatus
  buyerId: string
  productId: string
  deliveryMethod: '' | DeliveryMethod
  eventId: string
  startDate: string
  endDate: string
}

export function useManageOrders(user: User | null) {
  const [orders, setOrders] = useState<Order[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  
  // Filter state
  const [filters, setFilters] = useState<OrderFilters>({
    status: '',
    buyerId: '',
    productId: '',
    deliveryMethod: '',
    eventId: '',
    startDate: '',
    endDate: '',
  })

  // Fetch events for dropdown
  const fetchEvents = useCallback(async () => {
    if (!user?.isAdmin) return
    
    setEventsLoading(true)
    try {
      const eventsData = await eventsService.getFutureEvents()
      setEvents(eventsData)
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setEventsLoading(false)
    }
  }, [user?.isAdmin])

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!user?.isAdmin) return
    
    setLoading(true)
    setError(null)
    
    try {
      const filtersToSend: any = {}
      
      if (filters.status) {
        filtersToSend.status = [filters.status]
      }
      
      if (filters.buyerId) {
        filtersToSend.buyer_id = filters.buyerId
      }
      
      if (filters.productId) {
        filtersToSend.product_id = filters.productId
      }
      
      if (filters.deliveryMethod) {
        filtersToSend.delivery_method = filters.deliveryMethod
      }
      
      if (filters.eventId) {
        filtersToSend.event_id = filters.eventId
      }
      
      if (filters.startDate) {
        filtersToSend.start_date = new Date(filters.startDate).toISOString()
      }
      
      if (filters.endDate) {
        filtersToSend.end_date = new Date(filters.endDate).toISOString()
      }
      const ordersData = await adminService.getOrders(filtersToSend)
      setOrders(ordersData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }, [user?.isAdmin, filters])

  useEffect(() => {
    if (user?.isAdmin) {
      fetchEvents()
      fetchOrders()
    }
  }, [user?.isAdmin, fetchEvents, fetchOrders])

  const handleFilterChange = useCallback((key: keyof OrderFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      status: '',
      buyerId: '',
      productId: '',
      deliveryMethod: '',
      eventId: '',
      startDate: '',
      endDate: '',
    })
  }, [])

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return {
    orders,
    events,
    loading,
    eventsLoading,
    error,
    filters,
    showFilters,
    setShowFilters,
    handleFilterChange,
    clearFilters,
    hasActiveFilters,
    refetchOrders: fetchOrders,
  }
}

