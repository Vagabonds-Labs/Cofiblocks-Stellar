import { Prisma, SellerType } from '@prisma/client';
import { HttpException } from '@/exceptions/HttpException';
import { DbUsers, UserEntry, CreateUserEntry, UpdateUserEntry, DbRefreshToken, DbSessions } from '@/services/db';
import { RegisterUserData, UserResponse } from './types';
import { verifyStellarSignature } from '@/utils/stellarSignature';
import * as NonceService from './NonceService';
import * as OnChainRolesService from '@/services/onchain/OnChainRolesService';
import { ROLES } from '@/lib/StellarContracts/types';
import { logger } from '@/lib/logger';

const dbUsers = new DbUsers();
const dbRefreshToken = new DbRefreshToken();
const dbSessions = new DbSessions();

export async function getUserById(userId: string) {
    const user = await dbUsers.findUserById(userId);
    return user;
}

export async function registerUser(data: RegisterUserData): Promise<{ user: UserEntry; isNewUser: boolean }> {
  if (!data.signature) {
    throw new HttpException(400, 'Signature is required for wallet registration');
  }

  // El nonce tiene que haberlo emitido el backend y no haberse usado antes.
  await NonceService.consumeNonce(data.nonce, data.walletAddress);

  // Verificación ed25519 local, formato SEP-53. No hace falta tocar la red.
  verifyStellarSignature(
    data.walletAddress,
    NonceService.buildLoginMessage(data.nonce),
    data.signature
  );

  // Check if user with this wallet address already exists
  const existingUser = await dbUsers.findUserByWalletAddress(data.walletAddress);

  let user: UserEntry;
  let isNewUser = false;

  if (existingUser) {
    // User exists - this is a login
    user = existingUser;
  } else {
    // User doesn't exist - create new user
    isNewUser = true;
    const createData: CreateUserEntry = {
      walletAddress: data.walletAddress,
      walletProvider: data.walletProvider || 'stellar',
      sellerType: null,
      isAdmin: false,
    };
    user = await dbUsers.createUser(createData);
  }

  return { user, isNewUser };
}

export async function assertUserIsSeller(userId: string) {
  const user = await dbUsers.findUserById(userId);
  if (!user) {
    throw new HttpException(404, 'User not found', 'USER_NOT_FOUND');
  }
  if (!user.sellerType || user.sellerType !== 'PRODUCER') {
    throw new HttpException(404, 'User is not a producer', 'USER_NOT_A_PRODUCER');
  }
}


/**
 * Find a user by ID
 */
export async function findById(id: string) {
  return await dbUsers.findUserById(id);
}

/**
 * Find a user by wallet address
 */
export async function findByWalletAddress(walletAddress: string) {
  return await dbUsers.findUserByWalletAddress(walletAddress);
}


  /**
   * Update user information (name and/or email)
   */
export async function updateUser(
  userId: string,
  data: { name?: string; email?: string }
): Promise<UserResponse> {
  // Build update object with only provided fields
  const updateData: UpdateUserEntry = {};
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.email !== undefined) {
    updateData.email = data.email;
  }
  // Update user in database
  return await dbUsers.updateUser(userId, updateData);
}

  /**
   * Update user seller type
   */
export async function updateSellerType(
    userId: string,
    sellerType: SellerType | null
  ): Promise<UserResponse> {
    return await dbUsers.updateUser(userId, { sellerType });
  }

  /**
   * Get all users with filtering and pagination (admin only)
   */
  export async function getAllUsers(filters: {
    sellerType?: SellerType;
    isAdmin?: boolean;
    email?: string;
    name?: string;
    walletAddress?: string;
    walletProvider?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserResponse[]; total: number }> {
    // Build where clause for filtering
    const where: Prisma.UserWhereInput = {};

    if (filters.sellerType !== undefined) {
      where.sellerType = filters.sellerType;
    }

    if (filters.isAdmin !== undefined) {
      where.isAdmin = filters.isAdmin;
    }

    if (filters.email) {
      where.email = {
        contains: filters.email,
        mode: 'insensitive',
      };
    }

    if (filters.name) {
      where.name = {
        contains: filters.name,
        mode: 'insensitive',
      };
    }

    if (filters.walletAddress) {
      where.walletAddress = {
        contains: filters.walletAddress,
        mode: 'insensitive',
      };
    }

    if (filters.walletProvider) {
      where.walletProvider = {
        contains: filters.walletProvider,
        mode: 'insensitive',
      };
    }

    // Get total count
    const total = await dbUsers.countUsers(where);

    // Ensure limit and offset are numbers
    const limit = typeof filters.limit === 'number' ? filters.limit : (filters.limit ? parseInt(String(filters.limit), 10) : 50);
    const offset = typeof filters.offset === 'number' ? filters.offset : (filters.offset ? parseInt(String(filters.offset), 10) : 0);

    // Get users with pagination
    const users = await dbUsers.findUsersWithFilters(where, limit, offset);

    return { users, total };
  }

/**
 * Update user admin status (admin only)
 */
export async function updateAdminStatus(
  userId: string,
  isAdmin: boolean
): Promise<UserResponse> {
  return await dbUsers.updateUser(userId, { isAdmin });
}

  /**
   * Delete a user (admin only)
   */
export async function deleteUser(userId: string): Promise<void> {
  await dbRefreshToken.deleteRefreshTokensByUserId(userId);
  await dbSessions.markAllSessionsInactive(userId);

  // Delete the user
  await dbUsers.deleteUser(userId);
}


export async function updateUserSellerType(userId: string, sellerType: SellerType | null): 
Promise<{ user: UserResponse, tx_hash: string | null }> {
  let tx_hash: string | null = null;
  if (sellerType) {
    const user = await dbUsers.findUserById(userId);
    if (!user || !user.walletAddress) {
      throw new HttpException(404, 'User not found', 'USER_NOT_FOUND');
    }
    logger.info(`Assigning role ${sellerType} to wallet ${user.walletAddress}`);
    tx_hash = await OnChainRolesService.assignRole(sellerType as ROLES, user.walletAddress);
  }

  const updatedUser = await dbUsers.updateUser(userId, { sellerType });
  return { user: updatedUser, tx_hash };
}