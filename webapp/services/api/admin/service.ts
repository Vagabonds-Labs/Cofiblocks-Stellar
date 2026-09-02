/**
 * Events Service
 * Handles event-related API calls
 */

import { api } from '@/lib/api';
import { Order, OrderWithBuyer } from '../orders/types';
import { OrdersFilter } from './types';


export class AdminService {
  /**
   * Get all orders with filters
   */
  async getOrders(orderFilter: OrdersFilter): Promise<Order[]> {
    const response = await api.post<{data: Order[]; }>('/admin/orders', orderFilter);
    return response.data;
  }

  /**
   * Mark an order as delivered
   */
  async markOrderAsDelivered(orderId: string): Promise<string> {
    const response = await api.get<{message: string; }>(`/admin/orders/${orderId}/mark-as-delivered`);
    return response.message;
  }

  async getOrderById(orderId: string): Promise<OrderWithBuyer> {
    const response = await api.get<{data: OrderWithBuyer}>(`/admin/orders/${orderId}`);
    return response.data;
  }
}

// Export singleton instance
export const adminService = new AdminService();