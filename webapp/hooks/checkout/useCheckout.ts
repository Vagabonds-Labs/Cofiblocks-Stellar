'use client'

import { useEffect, useState, useRef } from 'react'
import { orderService, OrderItem, Order, CheckoutOrderTransaction, CheckoutOrderResponse } from '@/services/api/orders'
import { eventsService, Event } from '@/services/api/events'
import { ApiError } from '@/lib/api/types'
import { useTranslations } from 'next-intl'

export function useCheckout(orderId: string) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations()

  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery'>('pickup')
  const [events, setEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const [deliveryForm, setDeliveryForm] = useState({
    country: 'Costa Rica',
    state: '',
    city: '',
    address1: '',
    address2: '',
    name: '',
    phone: ''
  })

  const [deliveryPrice, setDeliveryPrice] = useState<number | null>(null)
  const [deliveryPriceLoading, setDeliveryPriceLoading] = useState(false)
  const [deliveryPriceError, setDeliveryPriceError] = useState<string | null>(null)
  const [isDeliveryFormSaved, setIsDeliveryFormSaved] = useState(false)

  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Track the last calculated combination to avoid duplicate API calls
  const lastCalculatedRef = useRef<string>('')

  useEffect(() => {
    if (!orderId) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch order items
        const items = await orderService.getOrderItems(orderId, 'PENDING_PAYMENT')
        setOrderItems(items)
        
        // Fetch order data to get expiresAt
        const orders = await orderService.getOrders()
        const currentOrder = orders.find(o => o.id === orderId)
        if (currentOrder) {
          setOrder(currentOrder)
        }
      } catch (err) {
        const apiError = err as ApiError
        if (apiError.code) {
          setError(t(`api_errors.${apiError.code}`))
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load order')
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [orderId])

  // Fetch events when pickup option is selected
  useEffect(() => {
    if (deliveryOption === 'pickup') {
      const loadEvents = async () => {
        setEventsLoading(true)
        setEventsError(null)
        try {
          const futureEvents = await eventsService.getFutureEvents()
          setEvents(futureEvents)
          // Auto-select first event if available and none selected
          setSelectedEventId(prev => {
            if (futureEvents.length > 0 && !prev) {
              return futureEvents[0].id
            }
            return prev
          })
        } catch (err) {
          setEventsError(err instanceof Error ? err.message : 'Failed to load events')
        } finally {
          setEventsLoading(false)
        }
      }

      loadEvents()
    } else {
      // Clear selected event when switching to delivery
      setSelectedEventId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryOption])

  // --- Derived values ---
  const subtotal = orderItems.reduce((sum, i) => sum + i.product.price * i.items, 0)
  const totalItems = orderItems.reduce((sum, i) => sum + i.items, 0)
  const totalPrice = subtotal + (deliveryPrice || 0)

  // --- Handlers ---
  const updateForm = (field: string, value: string) => {
    // Don't allow updates if form is saved
    if (isDeliveryFormSaved) return
    
    setDeliveryForm(prev => ({ ...prev, [field]: value }))
    // Clear delivery price when form changes
    setDeliveryPrice(null)
    setDeliveryPriceError(null)
  }

  const calculateDeliveryPrice = async (): Promise<boolean> => {
    if (!deliveryForm.state || !deliveryForm.city.trim() || !deliveryForm.address1.trim()) {
      setDeliveryPriceError('Missing required fields')
      return false
    }

    // Create a unique key for this combination
    const formKey = `${deliveryForm.state.toLowerCase()}-${deliveryForm.city.trim().toLowerCase()}`
    
    // Skip if we've already calculated for this exact combination
    if (lastCalculatedRef.current === formKey && deliveryPrice !== null) {
      return true
    }

    try {
      setDeliveryPriceLoading(true)
      setDeliveryPriceError(null)

      const response = await orderService.getHomeDeliveryPrice({
        country: deliveryForm.country,
        state: deliveryForm.state.toLowerCase(),
        city: deliveryForm.city.trim()
      })

      setDeliveryPrice(response.price)
      lastCalculatedRef.current = formKey
      return true
    } catch (err) {
      setDeliveryPriceError('Failed to fetch delivery price')
      lastCalculatedRef.current = ''
      return false
    } finally {
      setDeliveryPriceLoading(false)
    }
  }

  const saveDeliveryAddress = async () => {
    if (!deliveryForm.state || !deliveryForm.city.trim() || !deliveryForm.address1.trim() || !deliveryForm.name.trim()) {
      setDeliveryPriceError('Please fill in all required fields')
      return
    }

    const success = await calculateDeliveryPrice()
    
    // Only freeze the form if price calculation was successful
    if (success) {
      setIsDeliveryFormSaved(true)
    }
  }

  const editDeliveryAddress = () => {
    setIsDeliveryFormSaved(false)
    // Clear the last calculated ref so it can recalculate when saved again
    lastCalculatedRef.current = ''
  }

  // Reset when switching to pickup
  useEffect(() => {
    if (deliveryOption === 'pickup') {
      setDeliveryPrice(null)
      setDeliveryPriceError(null)
      setIsDeliveryFormSaved(false)
      lastCalculatedRef.current = ''
    } else {
      // Reset saved state when switching to delivery
      setIsDeliveryFormSaved(false)
    }
  }, [deliveryOption])

  const handleCheckout = async (stripe_checkout: boolean): Promise<CheckoutOrderResponse | null> => {
    setCheckoutError(null)

    // Validate delivery option
    if (deliveryOption === 'pickup') {
      if (!selectedEventId) {
        setCheckoutError('Please select an event for pickup')
        return null
      }
    } else {
      // Validate home delivery form
      if (!deliveryForm.state || !deliveryForm.city.trim() || !deliveryForm.address1.trim() || !deliveryForm.name.trim()) {
        setCheckoutError('Please fill in all required delivery fields')
        return null
      }
    }

    try {
      setCheckoutLoading(true)

      const checkoutData = {
        id: orderId,
        delivery_event_id: deliveryOption === 'pickup' ? selectedEventId! : undefined,
        stripe_checkout: stripe_checkout,
        delivery_home: deliveryOption === 'delivery' ? {
          country: deliveryForm.country,
          state: deliveryForm.state.toLowerCase(),
          city: deliveryForm.city.trim(),
          address1: deliveryForm.address1.trim(),
          address2: deliveryForm.address2?.trim() || undefined,
          name: deliveryForm.name.trim(),
          phone: deliveryForm.phone?.trim() || undefined,
        } : null,
      }

      const result = await orderService.checkoutOrder(checkoutData)
      return result
    } catch (err) {
      const apiError = err as ApiError
      if (apiError.message) {
        setCheckoutError(t(`api_errors.${apiError.code}`))
        return null
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to checkout order'
      setCheckoutError(errorMessage)
      return null
    } finally {
      setCheckoutLoading(false)
    }
  }

  return {
    loading,
    error,
    orderItems,
    order,

    deliveryOption,
    setDeliveryOption,

    deliveryForm,
    updateForm,

    deliveryPrice,
    deliveryPriceLoading,
    deliveryPriceError,
    calculateDeliveryPrice,
    isDeliveryFormSaved,
    saveDeliveryAddress,
    editDeliveryAddress,

    events,
    eventsLoading,
    eventsError,
    selectedEventId,
    setSelectedEventId,

    subtotal,
    totalItems,
    totalPrice,

    checkoutLoading,
    checkoutError,
    handleCheckout,
  }
}
