import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

export function startOrderExpirationJob() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      logger.debug('🟢 Starting order expiration job');
      const now = new Date();

      // Find all expired orders WITH their items
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: {
            in: [OrderStatus.PENDING_PAYMENT],
          },
          expiresAt: { lt: now },
        },
        include: {
          orderItems: {
            include: { product: true },
          },
        },
      });

      if (expiredOrders.length === 0) return;

      logger.info(
        { count: expiredOrders.length },
        '⏳ Found expired orders. Cancelling and restoring stock...'
      );

      // Run inside a transaction to ensure stock + order updates stay consistent
      await prisma.$transaction(async (tx) => {
        for (const order of expiredOrders) {
          // 1. Cancel the order
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED },
          });

          // 2. Restore reserved stock for each item
          for (const item of order.orderItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                reservedStock: {
                  decrement: item.items, // release reserved items
                },
              },
            });
          }
        }
      });

      logger.info(
        { count: expiredOrders.length },
        '🟢 Expired orders cancelled & reserved stock restored successfully'
      );

    } catch (error) {
      logger.error(error, '❌ Cron job failed while cancelling orders');
    }
  });
}
