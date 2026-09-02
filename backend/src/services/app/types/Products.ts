import { GrindType, ProductStatus } from "@prisma/client";

export interface ProductFilters {
    search?: string;
    region?: string;
    roastLevel?: string;
    minPrice?: number;
    maxPrice?: number;
    grindType?: string;
  }

  export interface CreateProductData {
    tokenId: string;
    contractAddress: string;
    network: string;
    title: string;
    description?: string;
    roastLevel: string;
    price: number;
    currentStock: number;
    imageUrl?: string;
    farmId: string;
    status: ProductStatus;
    sales: number;
    grindType: GrindType;
  }