import { api } from '@/lib/api'
import { toQueryString } from '@/lib/query'
import type { Delivery, DeliveryFarmer, DeliveryStatus } from '@/types/traceability'

export interface NewDelivery {
  farmerId: string
  collectionCenterId?: string
  weightKg: number
  /** ISO date-time; defaults to now. */
  deliveredAt?: string
}

/** Deliveries the Collector records; the farmer confirms each one in the bot. */
export const deliveriesService = {
  async farmers(search?: string): Promise<DeliveryFarmer[]> {
    const response = await api.get<{ data: { farmers: DeliveryFarmer[] } }>(
      `/deliveries/farmers${toQueryString({ search: search || undefined })}`
    )
    return response.data.farmers
  },

  async list(status?: DeliveryStatus): Promise<Delivery[]> {
    const response = await api.get<{ data: { deliveries: Delivery[] } }>(`/deliveries${toQueryString({ status })}`)
    return response.data.deliveries
  },

  async create(input: NewDelivery): Promise<Delivery> {
    const response = await api.post<{ data: { delivery: Delivery } }>('/deliveries', {
      farmer_id: input.farmerId,
      collection_center_id: input.collectionCenterId,
      weight_kg: input.weightKg,
      delivered_at: input.deliveredAt,
    })
    return response.data.delivery
  },

  async cancel(id: string): Promise<Delivery> {
    const response = await api.post<{ data: { delivery: Delivery } }>(`/deliveries/${id}/cancel`)
    return response.data.delivery
  },
}
