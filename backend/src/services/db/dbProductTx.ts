import { prisma } from '@/lib/prisma';
import { ProductTxType } from '@prisma/client';

export interface ProductTxEntry {
  id: string;
  productId: string;
  txType: ProductTxType;
  senderId: string;
  txHash: string;
  createdAt: Date;
}

export interface ProductTxWithSenderEntry extends ProductTxEntry {
  sender: {
    id: string;
    name: string | null;
    email: string | null;
    walletAddress: string | null;
  };
}

export interface CreateProductTxEntry {
  productId: string;
  txType: ProductTxType;
  senderId: string;
  txHash: string;
}

export class DbProductTx {
  async findProductTxByTxHash(txHash: string): Promise<ProductTxEntry | null> {
    const existingTx = await prisma.productTx.findFirst({
      where: { txHash },
    });

    return existingTx;
  }

  async createProductTx(data: CreateProductTxEntry): Promise<ProductTxEntry> {
    const productTx = await prisma.productTx.create({
      data: {
        productId: data.productId,
        txType: data.txType,
        senderId: data.senderId,
        txHash: data.txHash,
      },
    });

    return productTx;
  }

  async findProductTxsByProductId(productId: string): Promise<ProductTxWithSenderEntry[]> {
    const productTxs = await prisma.productTx.findMany({
      where: { productId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            walletAddress: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return productTxs as ProductTxWithSenderEntry[];
  }
}

