/**
 * Sells Service
 * Handles sells-related API calls
 */

import { api } from '@/lib/api';
import { GetSellsResponse } from './types';
import { OrderWithBuyer } from '../orders/types';
import { PreparedTransaction } from '@/types/contracts';

export class SellsService {
  /**
   * Get all sales for the current user (orders with orderItems where product.ownerId == userId)
   */
  async getSells(): Promise<GetSellsResponse> {
    const response = await api.get<{data: GetSellsResponse}>('/sells');
    return response.data;
  }

  /**
   * Get a single sale by order ID for the current user
   */
  async getSaleById(orderId: string): Promise<OrderWithBuyer> {
    const response = await api.get<{data: OrderWithBuyer}>(`/sells/${orderId}`);
    return response.data;
  }

  /**
   * Confirm delivery for a sale
   */
  async confirmDelivery(orderId: string): Promise<void> {
    await api.get<{data: { message: string }}>(`/sells/${orderId}/confirm_delivery`);
  }

  /**
   * Saldo reclamable en el contrato.
   * @returns el monto en la unidad mínima de USDC (7 decimales).
   */
  async getClaimBalance(): Promise<string> {
    const response = await api.get<{data: string}>('/sells/claim_balance');
    return response.data;
  }

  /** Transacción de cobro ya simulada, lista para que la firme la wallet. */
  async getClaimTx(): Promise<PreparedTransaction> {
    const response = await api.get<{data: PreparedTransaction}>('/sells/claim');
    return response.data;
  }

  async claimCallback(signedXdr: string): Promise<void> {
    await api.post<{data: void}>('/sells/claim/callback', { signed_xdr: signedXdr });
  }
}

// Export singleton instance
export const sellsService = new SellsService();

