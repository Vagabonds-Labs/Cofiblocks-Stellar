/**
 * Sells Service
 * Handles sells-related API calls
 */

import { api } from '@/lib/api';
import { GetSellsResponse } from './types';
import { OrderWithBuyer } from '../orders/types';
import { TransactionDetails } from '../onchain/types';

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
   * Get claim balance from the contract
   * @returns Claim balance as a string (wei amount)
   */
  async getClaimBalance(): Promise<string> {
    const response = await api.get<{data: string}>('/sells/claim_balance');
    return response.data;
  }

  async getClaimTx(): Promise<{ tx: TransactionDetails }> {
    const response = await api.get<{data: { tx: TransactionDetails }}>('/sells/claim');
    return response.data;
  }

  async claimCallback(txHash: string): Promise<void> {
    await api.post<{data: void}>('/sells/claim/callback', { tx_hash: txHash });
  }
}

// Export singleton instance
export const sellsService = new SellsService();

