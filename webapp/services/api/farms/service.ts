/**
 * Farm Service
 * Handles farm-related API calls
 */

import { api } from '@/lib/api';
import { FarmsResponse, FarmResponse, CreateFarmData, CreateFarmResponse, Farm } from './types';

export class FarmService {
  /**
   * Get all farms
   */
  async getAllFarms(): Promise<Farm[]> {
    const response = await api.get<{data: Farm[]}>('/farms')
    return response.data
  }

  /**
   * Get farms by current user
   */
  async getMyFarms(): Promise<Farm[]> {
    const response = await api.get<{data: Farm[]}>('/farms/my-farms')
    return response.data
  }

  /**
   * Get a farm by ID
   */
  async getFarmById(farmId: string): Promise<FarmResponse> {
    const response = await api.get<{data: FarmResponse}>(`/farms/${farmId}`)
    return response.data
  }

  /**
   * Create a new farm
   * @param data - Farm data
   * @param logoFile - Optional logo file to upload
   */
  async createFarm(data: CreateFarmData, logoFile?: File): Promise<CreateFarmResponse> {
    if (logoFile) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== "logo") {
          formData.append(key, String(value));
        }
      });
  
      formData.append("logo", logoFile);
      const response = await api.post<{data: CreateFarmResponse}>("/farms", formData)
      return response.data
    }
    const response = await api.post<{data: CreateFarmResponse}>("/farms", data)
    return response.data
  }
  

  /**
   * Delete a farm or user-farm relation
   * @param farmId - ID of the farm to delete
   */
  async deleteFarm(farmId: string): Promise<void> {
    await api.delete<{ message: string }>(`/farms/${farmId}`);
  }
}

// Export singleton instance
export const farmService = new FarmService();

