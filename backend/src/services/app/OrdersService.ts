import { DeliveryMethod, OrderStatus } from '@prisma/client';
import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';

import { CreateOrderRequest } from '@/schemas/orderSchemas';
import { 
  DbOrders, CreateOrderEntry, CreateOrderItemEntry, DbProducts, OrderForCheckoutEntry, CreateDeliveryEntry, OrderWithItemsEntry
} from '@/services/db';
import { OrderResponse, OrderItemResponse, CheckoutOrderInput, CheckoutOrderOutput } from './types/Orders';
import * as ordersMappers from '@/services/mappers/ordersMappers';
import * as OnChainBalancesService from '../onchain/OnChainBalancesService';
import * as OnChainProductsService from '../onchain/OnChainProductsService';
import { ContractFactory } from '@/lib/StellarContracts';
import * as NotificationService from './NotificationService';
import { DbUsers } from '../db/dbUsers';
import { isGamDelivery } from './DeliveryService';
import { OrderNotificationParams, sendOrderNotificationEmail } from '../email/emailService';
import { DateTime } from 'luxon';


const dbOrders = new DbOrders();
const dbProducts = new DbProducts();
const dbUsers = new DbUsers();

export async function createOrder(userId: string, data: CreateOrderRequest): Promise<string> {
    // Calculate expiration time (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Create order and order items in a transaction
    const orderData: CreateOrderEntry = {
      buyerId: userId,
      status: OrderStatus.PENDING_PAYMENT,
      expiresAt,
    };

    const orderItems: CreateOrderItemEntry[] = data.products.map((item) => ({
      orderId: '', // Will be set in the transaction
      productId: item.id,
      items: item.amount,
    }));

    // Create order and set reserved stock for each product in the same transaction
    const order = await dbOrders.createOrderWithItems(
      orderData,
      orderItems,
      (productId: string, amount: number, tx: any) => {
        return dbProducts.updateProductReservedStock(productId, amount, tx);
      }
    );

    return order.id;
  }

  /**
   * Get orders for a user
   * Optionally filter by status(es) - can filter by single or multiple statuses
   * Includes orderItems and delivery information
   */
export async function getOrdersByUser(userId: string, statuses?: OrderStatus[]): Promise<OrderResponse[]> {
    logger.info({ userId, statuses }, 'Fetching orders for user');
    const orders = await dbOrders.findOrdersByBuyerId(userId, statuses);

    logger.info({ userId, orderCount: orders.length }, 'Successfully fetched orders for user');

    return orders.map(order => ordersMappers.mapOrderToResponse(order));
  }

  /**
   * Get order items for a specific order
   * Includes product details and amount per item
   */
export async function getOrderItems(orderId: string, userId: string, status?: OrderStatus): Promise<OrderItemResponse[]> {
    const order = await dbOrders.findOrderByIdForItems(orderId, status);
    if (!order) {
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }
    if (order.buyerId !== userId) {
      throw new HttpException(
        403,
        'You are not authorized to view this order',
        'ORDER_ACCESS_DENIED'
      );
    }

    // Get order items with product details
    const orderItems = await dbOrders.findOrderItemsByOrderId(orderId);
    return orderItems.map((item) => ordersMappers.mapOrderItemToResponse(item));
  }


async function assertOrderIsPayable(order: OrderForCheckoutEntry, requestUserId: string) {
    if (order.buyerId !== requestUserId) {
        throw new HttpException(
            403,
            'You are not authorized to checkout this order',
            'ORDER_ACCESS_DENIED'
        );
    }

    if (
        order.status !== OrderStatus.PENDING_PAYMENT &&
        order.status !== OrderStatus.PENDING_DELIVERY_PAYMENT
    ) {
        throw new HttpException(
            400,
            `Order status must be ${OrderStatus.PENDING_PAYMENT} or ${OrderStatus.PENDING_DELIVERY_PAYMENT}`,
            'INVALID_ORDER_STATUS'
        );
    }

    if (order.expiresAt < new Date()) {
        throw new HttpException(400, 'Order has expired', 'ORDER_EXPIRED');
    }
}

/**
 * Cuánto puede vivir el XDR que firma el comprador, en segundos.
 *
 * La transacción **nunca** debe sobrevivir a la orden: `OrderExpirationJob`
 * cancela a los 10 minutos y devuelve el stock reservado, así que un XDR con
 * más vida que la orden permite que el pago confirme sobre stock ya liberado
 * y quizá revendido. El pago entra igual y hay que reconciliarlo a mano.
 *
 * Se reserva un margen para el submit y la confirmación en red, y se recorta
 * a lo que quede de la orden.
 */
const SUBMIT_MARGIN_SECONDS = 60;
const MIN_SIGNING_WINDOW_SECONDS = 60;
const MAX_SIGNING_WINDOW_SECONDS = 5 * 60;

function signingWindowForOrder(expiresAt: Date): number {
  const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  const window = Math.min(remaining - SUBMIT_MARGIN_SECONDS, MAX_SIGNING_WINDOW_SECONDS);

  if (window < MIN_SIGNING_WINDOW_SECONDS) {
    throw new HttpException(
      400,
      'The order is about to expire; start a new one before paying',
      'ORDER_EXPIRING_TOO_SOON'
    );
  }
  return window;
}

  /**
   * Checkout an order
   * Validates order, creates delivery record, and calculates totals
   */
export async function createRequestOrderPayment(
    userId: string,
    walletAddress: string,
    data: CheckoutOrderInput,
    deliveryEntry: CreateDeliveryEntry,
  ): Promise<CheckoutOrderOutput> {
    const order = await dbOrders.findOrderByIdForCheckout(data.id);
    if (!order) {
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }
    await assertOrderIsPayable(order, userId);
  
    const orderTotal = order.orderItems.reduce((sum: number, item: any) => sum + item.product.price * item.items, 0);
    const deliveryId = await dbOrders.updateOrderDelivery(order.id, order.deliveryId, deliveryEntry);
    if (!deliveryId) {
      throw new HttpException(500, 'Failed to update order delivery', 'FAILED_TO_UPDATE_ORDER_DELIVERY');
    }
    const deliveryFee = deliveryEntry.price ?? 0;

    // Check that user has enough balance to pay for the order
    if (!await OnChainBalancesService.canUserPayUSDC(walletAddress, orderTotal + deliveryFee)) {
      throw new HttpException(400, 'Insufficient USDC balance to pay for the order', 'INSUFFICIENT_USDC_BALANCE');
    }

    // Una sola transacción: el fee de envío se cobra dentro de `buy_products`.
    const tx = await OnChainProductsService.buyProductsTx(
      order.orderItems.map((item) => item.product.tokenId ?? ''),
      order.orderItems.map((item) => item.items),
      deliveryFee,
      walletAddress,
      signingWindowForOrder(order.expiresAt),
    );
    return { tx };
  }


/**
 * Cierra el pago de una orden.
 *
 * Recibe el **XDR firmado**, no un hash: el backend lo envuelve en un fee-bump,
 * lo manda y saca el hash del submit, que es más confiable que confiar en el que
 * reporte el cliente. También es lo que hace que el comprador no necesite XLM.
 */
export async function verifyOrderPayment(orderId: string, signedXdr: string): Promise<OrderResponse> {
    const order = await dbOrders.findOrderByIdForCheckout(orderId);
    if (!order) {
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }
    const user = order.buyer;
    if (!user || !user.walletAddress) {
      throw new HttpException(404, 'Buyer of the order not found', 'BUYER_NOT_FOUND');
    }

    const { hash: txHash } = await new ContractFactory().getTxSubmitter().submitSigned(signedXdr);
    logger.info('Payment transaction confirmed on chain with hash ' + txHash);

    const isTxHashAlreadyUsed = await dbOrders.isTxHashAlreadyUsed(txHash);
    if (isTxHashAlreadyUsed) {
      throw new HttpException(400, 'Transaction hash already used', 'TX_HASH_ALREADY_USED');
    }

    // La orden pudo expirar entre que se firmó la transacción y llegó el
    // callback. El pago ya está hecho y el stock ya se liberó: hay que
    // reconciliarlo a mano, no dejarlo pasar en silencio.
    if (order.status === OrderStatus.CANCELLED) {
      logger.error(
        { orderId, txHash },
        'Payment confirmed on chain for an order that had already been cancelled'
      );
      throw new HttpException(
        409,
        'The order expired before the payment was confirmed. The payment went through and needs to be reconciled.',
        'ORDER_CANCELLED_WITH_CONFIRMED_PAYMENT'
      );
    }

    logger.info('Verifying buy product events for order ' + orderId + ' with tx hash ' + txHash);
    await OnChainProductsService.verifyBuyProductEvents(
      order.orderItems.map((item) => item.product.tokenId ?? ''),
      order.orderItems.map((item) => item.items),
      user.walletAddress,
      txHash
    );
    logger.info('Buy product events verified successfully, marking order as paid');

    // All items were bought correctly, now we need to update the order status to PAID
    await dbOrders.markOrderAsPaid(orderId, txHash);
    // Mark producer claim balanace on all items of the order
    const productOwners = await dbOrders.markProducerClaimBalance(order.id);
    for (const owner of productOwners) {
        NotificationService.pushInfoNotification(owner, 'ORDER_RECEIVED', [orderId.toString()]);
    }

    if (!order.deliveryId) {
        throw new HttpException(500, 'Delivery information is missing', 'DELIVERY_INFORMATION_MISSING');
    }

    const delivery = await dbOrders.findOrderDeliveryById(order.deliveryId);
    if (!delivery) {
        throw new HttpException(500, 'Delivery information is missing', 'DELIVERY_INFORMATION_MISSING');
    }

    if (delivery.method === DeliveryMethod.HOME && delivery.price) {
        const orderTotal = order.orderItems.reduce(
            (sum: number, item: any) => sum + item.product.price * item.items, 0
        );
        logger.info('Verifying delivery payment for order ' + orderId + ' with tx hash ' + txHash);
        await OnChainProductsService.verifyDeliveryPayment(orderTotal, delivery.price, txHash);
        logger.info('Delivery payment verified successfully');
        await dbOrders.updateOrderStatus(orderId, OrderStatus.IN_DELIVERY);
        await dbOrders.registerDeliveryPayment(delivery.id, txHash);
    }

    NotificationService.pushInfoNotification(user.id, 'ORDER_PAID', [orderId.toString()]);
    // reload order and return it
    const reloadedOrder = await dbOrders.findOrderById(orderId);
    if (!reloadedOrder) {
      throw new HttpException(500, 'Failed to reload order', 'FAILED_TO_RELOAD_ORDER');
    }

    try {
      logger.info('Notifying producer email for order ' + orderId);
      await notifyProducerEmail(reloadedOrder);
    } catch (error) {
      logger.error('Error notifying producer email: ' + error);
    }

    return ordersMappers.mapOrderToResponse(reloadedOrder);
  }

export async function deletePendingPaymentOrder(orderId: string, userId: string): Promise<void> {
    const order = await dbOrders.findOrderByIdForCheckout(orderId);
    if (!order) {
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }
    if (order.buyerId !== userId) {
      throw new HttpException(403, 'You are not authorized to delete this order', 'ORDER_ACCESS_DENIED');
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new HttpException(400, 'Only pending payment orders can be deleted', 'CANNOT_DELETE_PAID_ORDER');
    }
    await dbOrders.deletePendingPaymentOrder(orderId);
  }

export async function getOrderById(orderId: string, userId: string, isAdmin: boolean = false): Promise<OrderResponse> {
    const order = await dbOrders.findOrderById(orderId);
    if (!order) {
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new HttpException(404, 'Order is cancelled', 'ORDER_CANCELLED');
    }
    if (!isAdmin && order.buyerId !== userId) {
      throw new HttpException(403, 'You are not authorized to view this order', 'ORDER_ACCESS_DENIED');
    }
    return ordersMappers.mapOrderToResponse(order);
  }

export async function getLatestOrder(userId: string): Promise<OrderResponse> {
    logger.info('Getting latest pending payment order for user ' + userId);
    const order = await dbOrders.findLatestPendingPaymentOrderByBuyerId(userId);
    if (!order) {
      throw new HttpException(404, 'No order found', 'NO_ORDER_FOUND');
    }
    return ordersMappers.mapOrderToResponse(order);
  }


async function notifyProducerEmail(order: OrderWithItemsEntry): Promise<void> {
  const buyer = await dbUsers.findUserById(order.buyerId);
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
  const orderDateStr = DateTime.fromJSDate(order.createdAt)
    .setZone('UTC')
    .toFormat('yyyy-MM-dd HH:mm');
  const deliveryEventDate = order.delivery?.event?.startAt
    ? DateTime.fromJSDate(order.delivery.event.startAt)
        .setZone(order.delivery.event.timezone ?? 'UTC')
        .toFormat('yyyy-MM-dd HH:mm')
    : null;

  const itemsByOwnerId = new Map<string, typeof order.orderItems>();
  for (const item of order.orderItems) {
    const ownerId = item.product.ownerId;
    const existing = itemsByOwnerId.get(ownerId) ?? [];
    existing.push(item);
    itemsByOwnerId.set(ownerId, existing);
  }

  for (const [ownerId, items] of itemsByOwnerId) {
    logger.info('Notifying producer with id ' + ownerId + ' for order ' + order.id);
    const producer = await dbUsers.findUserById(ownerId);
    const recipientEmail = producer?.email?.trim();
    const recipients = [recipientEmail, ...adminEmails]
      .filter((email): email is string => Boolean(email))
      .filter((email, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === email.toLowerCase()) === index);
    if (recipients.length === 0) {
      logger.warn({ orderId: order.id, ownerId }, 'Skipping producer email: no producer or admin recipients found');
      continue;
    }

    const orderItems = items.map((item) => ({
      id: item.product.id,
      name: item.product.title,
      quantity: item.items,
    }));
    const producerSubtotal = items.reduce(
      (sum, item) => sum + item.product.price * item.items,
      0
    );

    const deliveryAddress =
      order.delivery?.address1
        ? [
            order.delivery.address1,
            order.delivery.address2,
            order.delivery.city,
            order.delivery.state,
            order.delivery.country,
          ].filter(Boolean).join(', ')
        : null;


    for (const recipient of recipients) {
      const params: OrderNotificationParams = {
        order_id: order.id,
        order_items: orderItems,
        order_total: producerSubtotal,
        delivery_address: deliveryAddress,
        delivery_recipient_name: order.delivery?.name ?? null,
        delivery_recipient_phone: order.delivery?.phone ?? null,
        delivery_event: order.delivery?.event?.title ?? null,
        delivery_event_date: deliveryEventDate,
        order_date: orderDateStr,
        recipient_email: recipient,
        buyer_email: buyer?.email ?? null,
        buyer_wallet: buyer?.walletAddress ?? '',
        language: 'es',
      };
      await sendOrderNotificationEmail(params);
    }
  }
}