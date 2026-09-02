import { prisma } from '@/lib/prisma';
import { StripeProduct } from '@prisma/client';

export interface StripeProductEntry {
  id: string;
  productId: string;
  stripeProductId: string;
  stripePriceId: string;
  stripePriceActive: boolean;
  createdAt: Date;
}

export class DbStripeProducts {
    async insertNewProduct(
        productId: string, stripeProductId: string, stripePriceId: string
    ): Promise<StripeProductEntry> {
        const newProduct = await prisma.stripeProduct.create({
            data: {
                productId,
                stripeProductId,
                stripePriceId,
                stripePriceActive: true,
            },
        });

        return newProduct as StripeProductEntry;
    }

    async findStripeProductByProductId(productId: string): Promise<StripeProductEntry | null> {
        const product = await prisma.stripeProduct.findFirst({
            where: { productId, stripePriceActive: true },
        });

        return product as StripeProductEntry | null;
    }

    async findStripeProductsByProductIds(productIds: string[]): Promise<StripeProductEntry[]> {
        const products = await prisma.stripeProduct.findMany({
            where: { productId: { in: productIds }, stripePriceActive: true },
        });
        return products as StripeProductEntry[];
    }

    async disableStripeProduct(productId: string): Promise<number> {
        const result = await prisma.stripeProduct.updateMany({
            where: {
              productId,
              stripePriceActive: true,
            },
            data: {
              stripePriceActive: false,
            },
        });
        
        return result.count;
    }
}
