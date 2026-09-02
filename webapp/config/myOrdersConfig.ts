import { OrderStatus } from '@/services/api/orders'

export const filterConfig = {
  pending_action: {
    labelKey: 'my_orders.filters.requires_action',
    statuses: ['PENDING_PAYMENT', 'PENDING_DELIVERY_PAYMENT'] as OrderStatus[],
  },
  pending_delivery: {
    labelKey: 'my_orders.filters.in_delivery',
    statuses: ['PAID', 'IN_DELIVERY'] as OrderStatus[],
  },
  delivered: {
    labelKey: 'my_orders.filters.delivered',
    statuses: ['DELIVERED'] as OrderStatus[],
  },
}
