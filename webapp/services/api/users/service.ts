/**
 * User Service
 * Handles user-related API calls
 */

import { api } from '@/lib/api';
import { toQueryString } from '@/lib/query';
import { GetAllUsersFilters, GetAllUsersResponse, User } from './types';


export class UserService {
  /**
   * Get all users (admin only)
   * @param filters - Optional filters for users
   */
  async getAllUsers(filters: GetAllUsersFilters = {}): Promise<GetAllUsersResponse> {
    // Build query string from filters
    const queryString = toQueryString({
      seller_type: filters.sellerType,
      is_admin: filters.isAdmin,
      email: filters.email,
      name: filters.name,
      wallet_address: filters.walletAddress,
      wallet_provider: filters.walletProvider,
      limit: filters.limit,
      offset: filters.offset,
    });
    
    const response = await api.get<{data: GetAllUsersResponse}>(`/users${queryString}`);
    return response.data;
  }

  /**
   * Update user seller type (admin only)
   * @param userId - User ID
   * @param sellerType - New seller type (PRODUCER, ROASTER, or null for buyer only)
   */
  async updateSellerType(
    userId: string, sellerType: 'PRODUCER' | 'ROASTER' | null): Promise<{ user: User, tx_hash: string | null }> 
  {
    const response = await api.patch<{ data: { user: User, tx_hash: string | null } }>(
      `/users/${userId}/seller-type`,
      { sellerType }
    );
    return response.data;
  }

  /**
   * Update user admin status (admin only)
   * @param userId - User ID
   * @param isAdmin - New admin status
   */
  async updateAdminStatus(userId: string, isAdmin: boolean): Promise<User> {
    const response = await api.patch<{ data: { user: User } }>(
      `/users/${userId}/admin`,
      { isAdmin }
    );
    return response.data.user;
  }

  /**
   * Delete a user (admin only)
   * @param userId - User ID
   */
  async deleteUser(userId: string): Promise<void> {
    await api.delete<{ message: string }>(`/users/${userId}`);
  }
}

// Export singleton instance
export const userService = new UserService();
