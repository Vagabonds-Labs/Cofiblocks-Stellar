import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';
import { DbOrders } from '@/services/db';
import { OrderResponse } from './types/Orders';
import { OrderStatus } from '@prisma/client';
import { mapOrderToResponse } from '../mappers/ordersMappers';
import * as OnChainBalancesService from '@/services/onchain/OnChainBalancesService';
import { TransactionDetails, TransactionType } from '@/lib/CofiblocksContracts/types/transactions';
import * as NotificationService from '@/services/app/NotificationService';

const dbOrders = new DbOrders();

/**
 * Get all sales for a user (orders with orderItems where product.ownerId == userId)
 * Only orderItems that belong to the current user are returned
 * Includes delivery information
 */
export async function getSalesByUser(userId: string): Promise<OrderResponse[]> {
    const orders = await dbOrders.findSalesByProductOwnerId(userId);
    return orders.map((order) => mapOrderToResponse(order));
  }

/**
 * Get a single sale by order ID for a user
 * Only orderItems that belong to the current user are returned
 * Order must be in status PAID, IN_DELIVERY, or DELIVERED
 * Includes delivery information and events
 */
export async function getSaleByOrderId(userId: string, orderId: string): Promise<OrderResponse> {
    // Get order with orderItems where product.ownerId == userId
    const order = await dbOrders.findSaleByOrderIdAndProductOwnerId(
        orderId, userId, [OrderStatus.PAID, OrderStatus.IN_DELIVERY, OrderStatus.DELIVERED]
    );
    if (!order) {
      logger.warn({ userId, orderId }, 'Sale not found for user');
      throw new HttpException(404, 'Sale not found', 'SALE_NOT_FOUND');
    }

    return mapOrderToResponse(order);
}

/**
 * Confirm delivery for orderItems belonging to the current user
 * Marks all orderItems as delivered where product.ownerId == userId
 * If all orderItems in the order are delivered, updates order status to DELIVERED
 */
export async function confirmDelivery(userId: string, orderId: string): Promise<void> {
    logger.info({ userId, orderId }, 'Confirming delivery for order');

    // Verify the order exists and has orderItems belonging to the user
    const order = await dbOrders.findSaleByOrderIdAndProductOwnerId(
        orderId, userId, [OrderStatus.PAID, OrderStatus.IN_DELIVERY]
    );
    if (!order) {
      logger.warn({ userId, orderId }, 'Order not found or user has no items in this order');
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }

    // Mark orderItems as delivered for this user's products
    const updatedCount = await dbOrders.markOrderItemsAsDeliveredByProductOwner(orderId, userId);
    logger.info({ userId, orderId, updatedCount }, 'Marked orderItems as delivered');

    // Check if all orderItems in the order are now delivered
    const allDelivered = await dbOrders.areAllOrderItemsDelivered(orderId);
    if (allDelivered && order.status !== OrderStatus.DELIVERED) {
      await dbOrders.updateOrderStatus(orderId, OrderStatus.DELIVERED);
      NotificationService.pushInfoNotification(userId, 'ORDER_DELIVERED', [orderId.toString()]);
      logger.info({ userId, orderId }, 'All items delivered, updated order status to DELIVERED');
    }
  }

  export async function getClaimTx(): Promise<{ tx: TransactionDetails, txType: TransactionType }> {
    const tx = await OnChainBalancesService.claimSellerPayments();
    return { tx: tx.getTransactionDetails(), txType: tx.getTransactionType() };
  }

  export async function claimCallback(userId: string, walletAddress: string, txHash: string): Promise<void> {
    // for now, just recheck the balance on chain, and if 0, clean all order items balance
    const balance = await OnChainBalancesService.getClaimBalance(walletAddress);
    if (balance !== '0') {
      throw new HttpException(500, 'Claim balance is not 0', 'CLAIM_BALANCE_NOT_0');
    }

    // clean all order items balance
    await dbOrders.cleanProducerClaimBalance(userId, txHash);
  }

  export async function getOrderSellers(orderId: string): Promise<string[]> {
    const sellers = await dbOrders.findOrderSellers(orderId);
    return sellers;
  }

