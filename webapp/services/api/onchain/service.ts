/**
 * Onchain Service
 * Handles onchain-related API calls
 */

import { api } from '@/lib/api';
import {
  BalanceResponse,
  ClaimableRole,
  ContractsInfoResponse,
  DistributionRunResponse,
  RoleBalance,
  TrustlineResponse,
} from './types';
import { PaymentToken, PreparedTransaction } from '@/types/contracts';

export class OnchainService {
  /**
   * Balances de una wallet. Sin `wallet`, los del usuario autenticado.
   * Devuelve XLM y USDC, más si la cuenta tiene trustline a USDC.
   */
  async getBalanceOf(wallet?: string): Promise<BalanceResponse> {
    const endpoint = wallet 
      ? `/onchain/balance_of?wallet=${encodeURIComponent(wallet)}`
      : '/onchain/balance_of';
    
    const response = await api.get<{data: BalanceResponse}>(endpoint);
    return response.data;
  }

  async withdraw(
    token: PaymentToken,
    amount: string, 
    withdrawAddress: string
  ): Promise<PreparedTransaction> {
    const response = await api.post<{data: PreparedTransaction}>(
      '/onchain/withdraw', { token, amount, withdrawAddress }
    );
    return response.data;
  }

  /**
   * Trustline a USDC patrocinada por el backend.
   * `required: false` significa que la cuenta ya la tiene.
   */
  async getUSDCTrustline(): Promise<TrustlineResponse> {
    const response = await api.get<{data: TrustlineResponse}>('/onchain/usdc_trustline');
    return response.data;
  }

  async submitUSDCTrustline(signedXdr: string): Promise<{ tx_hash: string }> {
    const response = await api.post<{data: { tx_hash: string }}>(
      '/onchain/usdc_trustline/callback', { signed_xdr: signedXdr }
    );
    return response.data;
  }

  async getContractsInfo(): Promise<ContractsInfoResponse> {
    const response = await api.get<{data: ContractsInfoResponse}>('/onchain/contracts_info');
    return response.data;
  }

  /**
   * Extiende el TTL de un producto on-chain.
   *
   * Soroban archiva el estado que no se toca durante mucho tiempo, y la
   * siguiente operación sobre un producto archivado falla hasta que alguien lo
   * restaura. Es un modo de fallo que no existía en Starknet.
   */
  async touchProduct(tokenId: string): Promise<{ tx_hash: string }> {
    const response = await api.post<{data: { tx_hash: string }}>(
      `/onchain/product/${encodeURIComponent(tokenId)}/touch`, {}
    );
    return response.data;
  }

  /**
   * Avanza el reparto de utilidades una tanda de páginas.
   *
   * Con `done: false` hay que volver a llamar. El cursor lo guarda el contrato,
   * así que repetir es seguro incluso si una llamada se cortó por el medio.
   */
  async runDistribution(): Promise<DistributionRunResponse> {
    const response = await api.post<{data: DistributionRunResponse}>(
      '/onchain/distribution/run', {}
    );
    return response.data;
  }

  /** Saldos de reparto del usuario, uno por cada rol que tiene. */
  async getDistributionBalances(): Promise<RoleBalance[]> {
    const response = await api.get<{data: { balances: RoleBalance[] }}>(
      '/onchain/distribution/claim_balance'
    );
    return response.data.balances;
  }

  async getDistributionClaim(role: ClaimableRole): Promise<PreparedTransaction> {
    const response = await api.get<{data: PreparedTransaction}>(
      `/onchain/distribution/claim?role=${role}`
    );
    return response.data;
  }

  async submitDistributionClaim(
    role: ClaimableRole,
    signedXdr: string
  ): Promise<{ tx_hash: string }> {
    const response = await api.post<{data: { tx_hash: string }}>(
      '/onchain/distribution/claim/callback', { role, signed_xdr: signedXdr }
    );
    return response.data;
  }
}

// Export singleton instance
export const onchainService = new OnchainService();
