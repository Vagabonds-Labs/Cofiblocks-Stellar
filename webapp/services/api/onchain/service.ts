/**
 * Onchain Service
 * Handles onchain-related API calls
 */

import { api } from '@/lib/api';
import { BalanceResponse, ContractsInfoResponse, TransactionResponse } from './types';
import { PaymentToken, SwapToken } from '@/types/contracts';

export class OnchainService {
  /**
   * Get balance for a wallet address
   * @param wallet - Optional wallet address. If not provided, uses authenticated user's wallet
   * @returns Balance response with wallet address and token balances (STRK, USDC, USDT)
   */
  async getBalanceOf(wallet?: string): Promise<BalanceResponse> {
    const endpoint = wallet 
      ? `/onchain/balance_of?wallet=${encodeURIComponent(wallet)}`
      : '/onchain/balance_of';
    
    const response = await api.get<{data: BalanceResponse}>(endpoint);
    return response.data;
  }

  async withdraw(
    token: PaymentToken | 'USDC_BRIDGED', 
    amount: string, 
    withdrawAddress: string
  ): Promise<TransactionResponse> {
    const response = await api.post<{data: TransactionResponse}>('/onchain/withdraw', { token, amount, withdrawAddress });
    return response.data;
  }

  async getContractsInfo(): Promise<ContractsInfoResponse> {
    const response = await api.get<{data: ContractsInfoResponse}>('/onchain/contracts_info');
    return response.data;
  }

  async mintSepoliaUSDC(): Promise<void> {
    await api.get<{data: void}>('/onchain/mint_sepolia_usdc');
  }

  async getSwapPrice(token: SwapToken, amount: number): Promise<string> {
    const response = await api.get<{data: string}>(`/onchain/swap_price?token=${token}&amount=${amount}`);
    return response.data;
  }

  async swapTokenForUSDC(token: SwapToken, amount: number): Promise<TransactionResponse[]> {
    const response = await api.post<{data: TransactionResponse[]}>('/onchain/swap', { token, amount });
    return response.data;
  }
}

// Export singleton instance
export const onchainService = new OnchainService();

