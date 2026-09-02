import { prisma } from '@/lib/prisma';
import { Prisma, GrindType, ProductStatus } from '@prisma/client';

export interface ProductEntry {
  id: string;
  tokenId: string | null;
  contractAddress: string;
  network: string;
  title: string;
  description: string | null;
  roastLevel: string;
  grindType: GrindType | null;
  price: number;
  currentStock: number;
  reservedStock: number;
  status: ProductStatus;
  sales: number;
  imageUrl: string | null;
  farmId: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithFarmEntry extends ProductEntry {
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
    ownerId: string;
  };
}

export interface ProductForOrderEntry {
  id: string;
  currentStock: number;
  reservedStock: number;
  status: ProductStatus;
  title: string;
}

export interface ProductForOwnershipEntry {
  id: string;
  tokenId: string | null;
  ownerId: string;
  status: ProductStatus;
  currentStock: number;
  reservedStock: number;
}

export interface CreateProductEntry {
  tokenId: string | null;
  contractAddress: string;
  network: string;
  title: string;
  description?: string | null;
  roastLevel: string;
  price: number;
  currentStock: number;
  status: ProductStatus;
  sales: number;
  imageUrl?: string | null;
  farmId: string;
  grindType: GrindType | null;
  ownerId: string;
}

export interface UpdateProductEntry {
  currentStock?: number;
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  status?: ProductStatus;
}

export interface UpdateProductOnchainEntry {
  tokenId: string;
  price: number;
  currentStock: number;
}

export class DbProducts {

  async findProductsByFarmId(farmId: string): Promise<{ id: string }[]> {
    const products = await prisma.product.findMany({
      where: {
        farmId: farmId,
      },
      select: {
        id: true,
      },
    });

    return products;
  }

  async findProductsByTokenId(tokenId: string): Promise<ProductEntry[]> {
    const products = await prisma.product.findMany({
      where: { tokenId },
    });

    return products;
  }

  async createProduct(data: CreateProductEntry): Promise<ProductWithFarmEntry> {
    const product = await prisma.product.create({
      data: {
        tokenId: data.tokenId,
        contractAddress: data.contractAddress,
        network: data.network,
        title: data.title,
        description: data.description || null,
        roastLevel: data.roastLevel,
        price: data.price,
        currentStock: data.currentStock,
        status: data.status,
        sales: data.sales,
        imageUrl: data.imageUrl || null,
        farmId: data.farmId,
        grindType: data.grindType,
        ownerId: data.ownerId,
      },
      include: {
        farm: true,
      },
    });

    return product as ProductWithFarmEntry;
  }

  async findProductsWithFilters(where: Prisma.ProductWhereInput): Promise<ProductWithFarmEntry[]> {
    const products = await prisma.product.findMany({
      where,
      include: { farm: true },
      orderBy: { createdAt: 'desc' },
    });

    return products as ProductWithFarmEntry[];
  }

  async findProductsByOwnerId(ownerId: string): Promise<ProductWithFarmEntry[]> {
    const products = await prisma.product.findMany({
      where: { ownerId },
      include: { farm: true },
      orderBy: { createdAt: 'desc' },
    });

    return products as ProductWithFarmEntry[];
  }

  async updateProductStatus(productId: string, status: ProductStatus): Promise<void> {
    await prisma.product.update({
      where: { id: productId },
      data: { status },
    });
  }

  async updateProductOnchainData(productId: string, data: UpdateProductOnchainEntry): Promise<ProductEntry> {
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        tokenId: data.tokenId,
        price: data.price,
        currentStock: data.currentStock,
      },
    });
    return updatedProduct as ProductEntry;
  }

  async findProductByIdForOwnership(productId: string): Promise<ProductForOwnershipEntry | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        ownerId: true,
        status: true,
      },
    });

    return product as ProductForOwnershipEntry | null;
  }

  async findProductByIdWithFarm(productId: string): Promise<ProductWithFarmEntry | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        farm: true,
      },
    });

    return product as ProductWithFarmEntry | null;
  }

  async findProductByIdForUpdate(productId: string): Promise<ProductForOwnershipEntry | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        tokenId: true,
        ownerId: true,
        currentStock: true,
        reservedStock: true,
        status: true,
      },
    });

    return product as ProductForOwnershipEntry | null;
  }

  async updateProduct(productId: string, data: UpdateProductEntry): Promise<ProductWithFarmEntry> {
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: data,
      include: {
        farm: true,
      },
    });

    return updatedProduct as ProductWithFarmEntry;
  }

  async deleteProduct(productId: string): Promise<void> {
    await prisma.product.delete({
      where: { id: productId },
    });
  }

  async findProductsByIds(productIds: string[]): Promise<ProductForOrderEntry[]> {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        currentStock: true,
        reservedStock: true,
        status: true,
        title: true,
      },
    });
    return products as ProductForOrderEntry[];
  }

  async updateProductReservedStock(productId: string, increment: number, tx?: any): Promise<void> {
    const client = tx || prisma;
    await client.product.update({
      where: { id: productId },
      data: {
        reservedStock: {
          increment,
        },
      },
    });
  }
}

