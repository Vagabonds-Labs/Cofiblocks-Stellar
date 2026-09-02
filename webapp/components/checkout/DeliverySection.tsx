'use client'

import { useState } from 'react'
import { useCheckout } from '../../hooks/checkout/useCheckout'
import { formatEventDateTime } from '@/utils/formatting'
import {
  CalendarIcon,
  MapPinIcon,
  PencilSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

export interface DeliverySectionProps {
  checkout: ReturnType<typeof useCheckout>
  t: (key: string) => string
  isProcessingPayment?: boolean
}

export function DeliverySection({
  checkout,
  t,
  isProcessingPayment = false,
}: DeliverySectionProps) {
  const {
    deliveryOption,
    setDeliveryOption,
    deliveryForm,
    updateForm,
    deliveryPrice,
    deliveryPriceLoading,
    deliveryPriceError,
    isDeliveryFormSaved,
    saveDeliveryAddress,
    editDeliveryAddress,
    events,
    eventsLoading,
    eventsError,
    selectedEventId,
    setSelectedEventId,
  } = checkout

  const [showAddress2, setShowAddress2] = useState(false)

  const costaRicaStates = [
    'San Jose',
    'Heredia',
    'Alajuela',
    'Cartago',
    'Puntarenas',
    'Guanacaste',
    'Limon',
  ]

  const isFormInvalid =
    !deliveryForm.name.trim() ||
    !deliveryForm.state ||
    !deliveryForm.city.trim() ||
    !deliveryForm.address1.trim()

  return (
    <>
      {/* Delivery Option Selector */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex gap-2">
          {(['pickup', 'delivery'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setDeliveryOption(opt)}
              disabled={isProcessingPayment}
              className={`flex-1 py-3 rounded-md border text-sm font-medium transition
                ${
                  deliveryOption === opt
                    ? 'bg-black text-white'
                    : 'bg-white hover:bg-gray-50'
                }
                ${isProcessingPayment ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {opt === 'pickup'
                ? t('checkout.pickup_at_event')
                : t('checkout.home_delivery')}
            </button>
          ))}
        </div>
      </div>

      {/* PICKUP */}
      {deliveryOption === 'pickup' && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4">{t('checkout.select_event')}</h3>

          {eventsLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {eventsError && (
            <p className="text-sm text-red-600">{eventsError}</p>
          )}

          {!eventsLoading && events.length > 0 && (
            <div className="space-y-3">
              {events.map((event) => (
                <label
                  key={event.id}
                  className={`flex gap-3 p-4 border rounded-lg cursor-pointer transition
                    ${
                      selectedEventId === event.id
                        ? 'border-green-500 bg-green-50'
                        : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <input
                    type="radio"
                    checked={selectedEventId === event.id}
                    onChange={() => setSelectedEventId(event.id)}
                    disabled={isProcessingPayment}
                  />

                  <div className="flex-1 text-sm">
                    <div className="font-semibold">{event.title}</div>
                    <div className="flex gap-4 text-gray-500 mt-1">
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="w-4 h-4" />
                          {event.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        {formatEventDateTime(event.startAt, event.endAt, event.timezone, event.isAllDay)}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DELIVERY */}
      {deliveryOption === 'delivery' && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4">
            {t('checkout.delivery_address')}
          </h3>

          {/* SUMMARY MODE */}
          {isDeliveryFormSaved && (
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm space-y-1">
                <div className="font-semibold">{deliveryForm.name}</div>
                <div>
                  {deliveryForm.city}, {deliveryForm.state}
                </div>
                <div>{deliveryForm.address1}</div>
                {deliveryForm.phone && <div>📞 {deliveryForm.phone}</div>}
                {deliveryPrice !== null && (
                  <div className="text-green-600 flex items-center gap-1">
                    <CheckCircleIcon className="w-4 h-4" />
                    {t('checkout.delivery_price_added')} – $
                    {deliveryPrice.toFixed(2)}
                  </div>
                )}
              </div>

              <button
                onClick={editDeliveryAddress}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-black"
              >
                <PencilSquareIcon className="w-4 h-4" />
                {t('checkout.button_edit')}
              </button>
            </div>
          )}

          {/* EDIT MODE */}
          {!isDeliveryFormSaved && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  placeholder={t('checkout.placeholder_name')}
                  value={deliveryForm.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  className="input"
                />
                <input
                  placeholder={t('checkout.placeholder_phone')}
                  value={deliveryForm.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={deliveryForm.state}
                  onChange={(e) => updateForm('state', e.target.value)}
                  className="input"
                >
                  <option value="">
                    {t('checkout.select_state')}
                  </option>
                  {costaRicaStates.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>

                <input
                  placeholder={t('checkout.label_city')}
                  value={deliveryForm.city}
                  onChange={(e) => updateForm('city', e.target.value)}
                  className="input"
                />
              </div>

              <input
                placeholder={t('checkout.label_address1')}
                value={deliveryForm.address1}
                onChange={(e) => updateForm('address1', e.target.value)}
                className="input"
              />

              {!showAddress2 ? (
                <button
                  onClick={() => setShowAddress2(true)}
                  className="text-sm text-gray-500 hover:underline"
                >
                  + {t('checkout.label_address2')}
                </button>
              ) : (
                <input
                  placeholder={t('checkout.label_address2')}
                  value={deliveryForm.address2}
                  onChange={(e) => updateForm('address2', e.target.value)}
                  className="input"
                />
              )}

              {deliveryPriceError && (
                <p className="text-sm text-red-600">
                  {deliveryPriceError}
                </p>
              )}

              <button
                onClick={saveDeliveryAddress}
                disabled={
                  isFormInvalid ||
                  deliveryPriceLoading ||
                  isProcessingPayment
                }
                className={`w-full py-3 rounded-md text-white font-semibold transition
                  ${
                    isFormInvalid || isProcessingPayment
                      ? 'bg-gray-400'
                      : 'bg-green-600 hover:bg-green-700'
                  }
                `}
              >
                {deliveryPriceLoading
                  ? t('checkout.loading_delivery_price')
                  : t('checkout.button_save')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
