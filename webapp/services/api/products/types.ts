import { PreparedTransaction } from '@/types/contracts';

export type GrindType = 'WHOLE' | 'GROUND';

export type ProductStatus = 'CREATION_REQUEST' | 'PUBLISHED' | 'HIDDEN' | 'CREATION_CANCELLED'

export interface Product {
    id: string;
    tokenId: string;
    contractAddress: string;
    network: string;
    title: string;
    description: string | null;
    roastLevel: string;
    price: number;
    currentStock: number;
    reservedStock: number;
    status: ProductStatus;
    sales: number;
    grindType: GrindType;
    imageUrl: string | null;
    farmId: string;
    farm: {
      id: string;
      name: string;
      sales: number;
      region: string;
      country: string;
      altitude: number;
      coordinates: string;
      website: string | null;
      logoUrl: string;
    };
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface CreateProductData {
    title: string;
    description?: string;
    roastLevel: string;
    price: number;
    currentStock: number;
    farmId: string;
    image?: File;
    grindType: GrindType;
  }


  export interface ProductsResponse {
    data: Product[];
  }
  
  export interface CreateProductResponse {
    message: string;
    product: Product;
  }
  
  export interface DeployProductRequest {
    initialStock: number;
    price: number;
    product_id: string;
  }
  
  export interface DeployCallbackRequest {
    product_id: string;
    /** Sobre firmado por la wallet. El backend lo envía y saca el hash. */
    signed_xdr: string;
  }
  
  export interface DeployCallbackResponse {
    message: string;
    product_id: string;
    tx_hash: string;
  }