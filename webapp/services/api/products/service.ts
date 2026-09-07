/**
 * Product Service
 * Handles product-related API calls
 */

import { api } from '@/lib/api'
import { PreparedTransaction } from '@/types/contracts';
import { 
  DeployProductRequest, 
  DeployCallbackRequest, 
  DeployCallbackResponse, 
  ProductStatus,
  ProductsResponse,
  CreateProductData,
  CreateProductResponse,
  Product,
} from './types';
import { toFormData } from './utils';

export class ProductService {
  /**
   * Get all products
   */
  async getAllProducts(query: string, options?: RequestInit): Promise<Product[]> {
    const response = await api.get<{data: Product[]}>(`/products${query}`, options)
    return response.data
  }
  
  /**
   * Get a product by ID
   */
  async getProductById(productId: string): Promise<Product> {
    const response = await api.get<{data: Product}>(`/products/${productId}`)
    return response.data
  }

  /**
   * Get products owned by the current user
   */
  async getMyProducts(): Promise<Product[]> {
    const response = await api.get<{data: Product[]}>('/products/my-products')
    return response.data
  }

  /**
   * Create a new product
   * @param data - Product data
   * @param imageFile - Optional image file to upload
   */
  async createProduct(data: CreateProductData, imageFile?: File): Promise<CreateProductResponse> {
    // If image file is provided, use FormData; otherwise use JSON
    if (imageFile) {
      const formData = toFormData(data, { image: imageFile });
      const response = await api.post<{data: CreateProductResponse}>('/products', formData)
      return response.data
    }
  
    // JSON request
    const response = await api.post<{data: CreateProductResponse}>('/products', data)
    return response.data
  }

  /**
   * Get transaction details for deploying a product on-chain
   * @param data - Deployment data (initialStock and price)
   */
  /** Devuelve la transacción ya simulada, lista para que la firme la wallet. */
  async deployProduct(data: DeployProductRequest): Promise<PreparedTransaction> {
    const response = await api.post<{data: PreparedTransaction}>('/products/deploy', data)
    return response.data
  }

  /**
   * Cierra la publicación: el backend envía la transacción firmada con
   * fee-bump y verifica el evento `create_product`.
   */
  async deployCallback(data: DeployCallbackRequest): Promise<DeployCallbackResponse> {
    const response = await api.post<{data: DeployCallbackResponse}>('/products/deploy/callback', data)
    return response.data
  }

  /**
   * Update a product
   * @param productId - Product ID
   * @param data - Product update data
   * @param imageFile - Optional image file to upload
   */
  async updateProduct(
    productId: string,
    data: {
      title?: string;
      description?: string;
      status?: ProductStatus;
    },
    imageFile?: File
  ): Promise<Product> {
  
    const payload = imageFile
      ? toFormData(data, { image: imageFile })
      : data;
  
    const response = await api.post<{data: Product}>(`/products/${productId}`, payload)
    return response.data
  }
  

  /**
   * Update product stock
   * @param productId - Product ID
   * @param currentStock - New stock value
   */
  async updateStock(
    productId: string,
    currentStock: number
  ): Promise<{ tx: PreparedTransaction | null; message: string }> {
    const response = await api.patch<{data: {tx: PreparedTransaction | null}; message: string}>(
      `/products/${productId}/stock`,
      { currentStock }
    )
    return {
      tx: response.data?.tx ?? null,
      message: response.message || 'Stock updated successfully'
    }
  }

  /**
   * Update product stock callback
   * @param productId - Product ID
   * @param txHash - Transaction hash
   */
  /** Envía la transacción firmada y sincroniza el stock con lo que quedó on-chain. */
  async submitStockUpdate(productId: string, signedXdr: string): Promise<void> {
    await api.post(`/products/${productId}/stock/callback`, { signed_xdr: signedXdr })
  }

  /**
   * Delete a product
   * @param productId - Product ID
   */
  async deleteProduct(productId: string): Promise<void> {
    return api.delete(`/products/${productId}`);
  }
}

// Export singleton instance
export const productService = new ProductService();

