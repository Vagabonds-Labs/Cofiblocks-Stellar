import { prisma } from '@/lib/prisma';

export interface CreateFarmEntry {
  name: string;
  sales: number;
  region: string;
  country: string;
  altitude: number;
  coordinates: string;
  website?: string | null;
  logoUrl?: string;
  ownerId: string;
}

export interface FarmEntry {
  id: string;
  name: string;
  sales: number;
  region: string;
  country: string;
  altitude: number;
  coordinates: string;
  website: string | null;
  logoUrl: string;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FarmWithProductsEntry extends FarmEntry {
  products: Array<{
    id: string;
    tokenId: string | null;
    contractAddress: string;
    network: string;
    title: string;
    description: string | null;
    roastLevel: string;
    grindType: string | null;
    price: number;
    currentStock: number;
    reservedStock: number;
    status: string;
    sales: number;
    imageUrl: string | null;
    farmId: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export class DbFarms {
  async createFarm(data: CreateFarmEntry): Promise<FarmEntry> {
    const farm = await prisma.farm.create({
      data: {
        name: data.name,
        sales: data.sales,
        region: data.region,
        country: data.country,
        altitude: data.altitude,
        coordinates: data.coordinates,
        website: data.website || null,
        logoUrl: data.logoUrl || '',
        ownerId: data.ownerId,
      },
    });

    return farm;
  }

  async findFarmsByIds(farmIds: string[]): Promise<FarmEntry[]> {
    const farms = await prisma.farm.findMany({
      where: { id: { in: farmIds } },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return farms;
  }

  async findAllFarms(): Promise<FarmEntry[]> {
    const farms = await prisma.farm.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return farms;
  }

  async findFarmById(farmId: string): Promise<FarmEntry | null> {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
    });

    return farm;
  }

  async findFarmByIdForDelete(farmId: string): Promise<{ id: string, ownerId: string | null } | null> {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { id: true, ownerId: true },
    });

    return farm;
  }

  async findFarmsByOwnerId(ownerId: string): Promise<FarmEntry[]> {
    const farms = await prisma.farm.findMany({
      where: { ownerId },
    });
    return farms;
  }

  async deleteFarm(farmId: string): Promise<void> {
    await prisma.farm.delete({
      where: { id: farmId },
    });
  }

  async findFarmWithProducts(farmId: string): Promise<FarmWithProductsEntry | null> {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        products: true,
      },
    });

    return farm as FarmWithProductsEntry | null;
  }
}

