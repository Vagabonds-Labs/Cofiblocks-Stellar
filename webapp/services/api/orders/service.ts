/**
 * Order Service
 * Handles order-related API calls
 */

import { api } from '@/lib/api';
import { 
  CreateOrderRequest, 
  CreateOrderResponse, 
  GetOrdersResponse, 
  GetOrderItemsResponse, 
  GetHomeDeliveryPriceRequest, 
  GetHomeDeliveryPriceResponse,
  CheckoutOrderRequest,
  CheckoutOrderTransaction,
  OrderItem,
  Order,
  CheckoutOrderCallbackRequest,
  OrderStatus,
  CheckoutOrderResponse,
} from './types';


export class OrderService {
  /**
   * Create a new order
   * @param data - Order data with products array
   */
  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    const response = await api.post<{data: CreateOrderResponse}>('/orders/create', data)
    return response.data
  }

  /**
   * Get orders for the current user
   * @param statuses - Optional status filter(s) - can be a single status string or array of statuses
   */
  async getOrders(statuses?: string | string[]): Promise<GetOrdersResponse> {
    let endpoint = '/orders';
    
    if (statuses) {
      if (Array.isArray(statuses)) {
        // Multiple statuses: join with comma
        const statusParam = statuses.map(s => encodeURIComponent(s)).join(',');
        endpoint = `/orders?status=${statusParam}`;
      } else {
        // Single status
        endpoint = `/orders?status=${encodeURIComponent(statuses)}`;
      }
    }
    
    const response = await api.get<{data: GetOrdersResponse}>(endpoint);
    return response.data;
  }

  /**
   * Get order items for a specific order
   * @param orderId - Order ID
   */
  async getOrderItems(orderId: string, status?: OrderStatus): Promise<OrderItem[]> {
    const params = new URLSearchParams();
  
    if (status !== undefined) {
      params.set('status', status);
    }
  
    const query = params.toString();
    const url = query
      ? `/orders/${orderId}/items?${query}`
      : `/orders/${orderId}/items`;
  
    const response = await api.get<{ data: OrderItem[] }>(url);
    return response.data;
  }
  

  /**
   * Get home delivery price based on location
   * @param data - Delivery location data
   */
  async getHomeDeliveryPrice(data: GetHomeDeliveryPriceRequest): Promise<GetHomeDeliveryPriceResponse> {
    const response = await api.post<{data: GetHomeDeliveryPriceResponse}>('/orders/get_home_delivery_price', data)
    return response.data;
  }

  /**
   * Checkout an order
   * @param data - Checkout data with order id and delivery information
   */
  async checkoutOrder(data: CheckoutOrderRequest): Promise<CheckoutOrderResponse> {
    const response = await api.post<{data: CheckoutOrderResponse}>('/orders/checkout', data)
    return response.data;
  }

  async checkoutOrderCallback(data: CheckoutOrderCallbackRequest): Promise<Order> {
    const response = await api.post<{data: Order}>('/orders/checkout/callback', data)
    return response.data;
  }

  async deletePendingPaymentOrder(orderId: string): Promise<void> {
    await api.delete('/orders/' + orderId);
  }

  async getOrderById(orderId: string): Promise<Order> {
    const response = await api.get<{data: Order}>('/orders/' + orderId);
    return response.data;
  }

  async getLatestOrder(): Promise<Order> {
    const response = await api.get<{data: Order}>('/orders/latest');
    return response.data;
  }
}

// Export singleton instance
export const orderService = new OrderService();

