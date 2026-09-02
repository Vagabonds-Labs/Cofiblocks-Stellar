import { prisma } from '@/lib/prisma';
import { Prisma, SellerType } from '@prisma/client';

export interface UserEntry {
  id: string;
  name: string | null;
  email: string | null;
  walletAddress: string | null;
  walletProvider: string | null;
  sellerType: SellerType | null;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserEntry {
  walletAddress: string;
  walletProvider?: string | null;
  sellerType?: SellerType | null;
  isAdmin?: boolean;
}

export interface UpdateUserEntry {
  name?: string;
  email?: string;
  sellerType?: SellerType | null;
  isAdmin?: boolean;
}

export interface UserFilters {
  sellerType?: SellerType;
  isAdmin?: boolean;
  email?: string;
  name?: string;
  walletAddress?: string;
  walletProvider?: string;
  limit?: number;
  offset?: number;
}

export class DbUsers {
  async findUserByEmail(email: string): Promise<UserEntry | null> {
    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        walletProvider: true,
        sellerType: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async findUserById(id: string): Promise<UserEntry | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        walletProvider: true,
        sellerType: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async findUserByWalletAddress(walletAddress: string): Promise<UserEntry | null> {
    const user = await prisma.user.findFirst({
      where: { walletAddress },
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        walletProvider: true,
        sellerType: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async createUser(data: CreateUserEntry): Promise<UserEntry> {
    const user = await prisma.user.create({
      data: {
        walletAddress: data.walletAddress,
        walletProvider: data.walletProvider || 'starknet',
        sellerType: data.sellerType || null,
        isAdmin: data.isAdmin || false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        walletProvider: true,
        sellerType: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async updateUser(userId: string, data: UpdateUserEntry): Promise<UserEntry> {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: data,
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        walletProvider: true,
        sellerType: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async countUsers(where: Prisma.UserWhereInput): Promise<number> {
    return await prisma.user.count({ where });
  }

  async findUsersWithFilters(
    where: Prisma.UserWhereInput,
    limit: number,
    offset: number
  ): Promise<UserEntry[]> {
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        walletProvider: true,
        sellerType: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  }

  async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }
}

