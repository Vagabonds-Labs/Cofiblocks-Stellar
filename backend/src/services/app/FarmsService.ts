import { HttpException } from "@/exceptions/HttpException";
import { CreateFarmEntry, DbFarms } from "../db/dbFarms";
import { DbProducts } from "../db/dbProducts";

const dbFarms = new DbFarms();
const dbProducts = new DbProducts();


export async function assertFarmExists(farmId: string) {
  const farm = await dbFarms.findFarmById(farmId);
  if (!farm) {
    throw new HttpException(404, 'Farm not found', 'FARM_NOT_FOUND');
  }
}

/**
   * Get all farms
   * Returns all farms in the system
   */
export async function getAllFarms() {
    const farms = await dbFarms.findAllFarms();
    return farms
}

export async function createFarm(data: CreateFarmEntry) {
    const farm = await dbFarms.createFarm(data);
    return farm;
}

  /**
   * Get farms by user (farms associated with the user via users_farms table)
   */
  export async function getFarmsByUser(userId: string) {
    // Get farm IDs from users_farms table
    const farms = await dbFarms.findFarmsByOwnerId(userId);
    return farms
  }

   /**
   * Get a farm by ID
   */
   export async function getFarmById(farmId: string){
    const farm = await dbFarms.findFarmById(farmId);
    if (!farm) {
      throw new HttpException(404, 'Farm not found', 'FARM_NOT_FOUND');
    }

    return farm;
  }

  /**
   * Delete a farm or user-farm relation
   * Logic:
   * 1. Check if there are products owned by the current user associated with the farm
   *    - If yes, throw error
   * 2. Check if the farm is associated with other users in users_farms table
   *    - If yes, only delete the current user's relation
   *    - If no, delete the farm from farms table as well
   */
  export async function deleteFarm(caller_user_id: string, farmId: string): Promise<void> {
    // Verify farm exists
    const farm = await dbFarms.findFarmByIdForDelete(farmId);
    if (!farm) {
      throw new HttpException(404, 'Farm not found', 'FARM_NOT_FOUND');
    }

    // Check if user has access to this farm
    const isOwner = farm.ownerId === caller_user_id;
    if (!isOwner) {
      throw new HttpException(
        403,
        'You are not the owner of this farm',
        'FARM_ACCESS_DENIED'
      );
    }

    // Check if there are products owned by the current user associated with this farm
    const userProducts = await dbProducts.findProductsByFarmId(farmId);
    if (userProducts.length > 0) {
      throw new HttpException(
        400,
        'Cannot delete farm: There are products associated with this farm. Please delete them first.',
        'FARM_HAS_PRODUCTS'
      );
    }

    await dbFarms.deleteFarm(farmId);
  }

  export async function getFarmWithProducts(farmId: string) {
    return await dbFarms.findFarmWithProducts(farmId);
  }