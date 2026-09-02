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
import * as NotificationService from './NotificationService';
import { DbStripeProducts } from '../db/dbStripeProducts';
import { DbUsers } from '../db/dbUsers';
import * as StripeService from '../stripe/stripeService';
import { isGamDelivery } from './DeliveryService';
import { OrderNotificationParams, sendOrderNotificationEmail } from '../email/emailService';
import { DateTime } from 'luxon';


const dbOrders = new DbOrders();
const dbProducts = new DbProducts();
const dbStripeProducts = new DbStripeProducts();
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

async function buildStripeCheckoutUrl(
  order: OrderForCheckoutEntry, gamDelivery: boolean, otherDelivery: boolean
): Promise<string> {
  const productIds = order.orderItems.map((item) => item.product.id);
  const stripeProducts = await dbStripeProducts.findStripeProductsByProductIds(productIds);
  if (stripeProducts.length !== productIds.length) {
    const notFoundProductIds = productIds.filter(
      (id) => !stripeProducts.some((product) => product.productId === id)
    );
    const msg = `There are ${notFoundProductIds.length} product(s) not available for stripe checkout: ${notFoundProductIds.join(', ')}`;
    logger.error(msg);
    throw new HttpException(400, msg, 'PRODUCTS_NOT_AVAILABLE_FOR_STRIPE_CHECKOUT');
  }


  const lineItems = order.orderItems.map((item) => ({
    price: stripeProducts.find((product) => product.productId === item.product.id)?.stripePriceId,
    quantity: item.items,
  }));

  if (gamDelivery) {
    lineItems.push({
      price: process.env.STRIPE_HOME_DELIVERY_GAM_PRICE,
      quantity: 1,
    });
  } else if (otherDelivery) {
    lineItems.push({
      price: process.env.STRIPE_HOME_DELIVERY_OTHER_PRICE,
      quantity: 1,
    });
  }

  const checkoutUrl = await StripeService.createStripeCheckoutSession(
    lineItems as StripeService.StripeLineItem[], 
    order.id
  );
  return checkoutUrl;
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
    stripeCheckout: boolean = false
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
      if (stripeCheckout) {
        throw new HttpException(400, 'Stripe checkout is currently disabled', 'STRIPE_CHECKOUT_DISABLED');
      }
      throw new HttpException(400, 'Insufficient USDC balance to pay for the order', 'INSUFFICIENT_USDC_BALANCE');
    }

    if (stripeCheckout) {
      let gamDelivery = false;
      let otherDelivery = false;
      if (deliveryFee > 0 && deliveryEntry.state) {
        const isGam = isGamDelivery(deliveryEntry.state);
        if (isGam) {
          gamDelivery = true;
        } else {
          otherDelivery = true;
        }
      }
      const checkoutUrl = await buildStripeCheckoutUrl(order, gamDelivery, otherDelivery);
      return { txs: [], checkoutUrl };
    }

    const txs = await OnChainProductsService.buyProductsTxs(
      order.orderItems.map((item) => item.product.tokenId ?? ''),
      order.orderItems.map((item) => item.items),
      orderTotal,
      deliveryFee,
      walletAddress,
    );
    return { txs, checkoutUrl: null };
  }


export async function verifyOrderPayment(orderId: string, txHash: string): Promise<OrderResponse> {
    // check if the tx hash is already used
    const isTxHashAlreadyUsed = await dbOrders.isTxHashAlreadyUsed(txHash);
    if (isTxHashAlreadyUsed) {
      throw new HttpException(400, 'Transaction hash already used', 'TX_HASH_ALREADY_USED');
    }

    const order = await dbOrders.findOrderByIdForCheckout(orderId);
    if (!order) {
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }
    const user = order.buyer;
    if (!user || !user.walletAddress) {
      throw new HttpException(404, 'Buyer of the order not found', 'BUYER_NOT_FOUND');
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


async function payForOrderWithInternalWallet(order: OrderForCheckoutEntry): Promise<OrderResponse> {
  const walletAddress = process.env.STRIPE_WALLET_ADDRESS;
  const privateKey = process.env.STRIPE_WALLET_PRIVATE_KEY;
  if (!walletAddress || !privateKey) {
    // TODO: we should offer a refund if there is an error here
    throw new HttpException(500, 'Stripe wallet address is not set', 'STRIPE_WALLET_ADDRESS_NOT_SET');
  }
  let orderTotal = order.orderItems.reduce(
    (sum: number, item: any) => sum + item.product.price * item.items, 0
  );

  let deliveryFee = 0;
  if (order.deliveryId) {
    const delivery = await dbOrders.findOrderDeliveryById(order.deliveryId);
    if (delivery && delivery.method === DeliveryMethod.HOME && delivery.price) {
        deliveryFee = delivery.price;
    }
  }

  if (!await OnChainBalancesService.canUserPayUSDC(walletAddress, orderTotal + deliveryFee)) {
    // TODO: we should offer a refund if there is an error here
    throw new HttpException(500, 'Unable to pay for order with internal wallet', 'INTERNAL_WALLET_PAYMENT_FAILED');
  }

  if (!order.buyer) {
    throw new HttpException(400, 'Order Buyer not found', 'BUYER_NOT_FOUND');
  }

  const txs = await OnChainProductsService.buyProductsTxs(
    order.orderItems.map((item) => item.product.tokenId ?? ''),
    order.orderItems.map((item) => item.items),
    orderTotal,
    deliveryFee,
    order.buyer.walletAddress,
  );

  let txHash: string = "";
  try {
    txHash = await OnChainProductsService.multicallBuyProductsTxs(txs, walletAddress, privateKey);
    logger.info('Multicall buy products txs successful, tx hash: ' + txHash);
  } catch (error) {
    // TODO: we should offer a refund if there is an error here
    logger.error('Error multicall buy products txs: ' + error);
    throw new HttpException(500, 'Unable to pay for order with internal wallet', 'INTERNAL_WALLET_PAYMENT_FAILED');
  }
  // Wait 5 seconds so that the tx is confirmed on chain
  await new Promise(resolve => setTimeout(resolve, 5000));

  const verifiedOrder = await verifyOrderPayment(order.id, txHash);
  return verifiedOrder;
}

export async function processOrderStripePayment(orderId: string, paymentIntentId: string, amount_usd: number): Promise<void> {
    logger.info(
        'Processing stripe payment for order ' + orderId + ' with paymentIntentId ' + paymentIntentId + ' and  amount_usd ' + amount_usd
    );
    const order = await dbOrders.findOrderByIdForCheckout(orderId);
    if (!order) {
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new HttpException(400, 'Only pending payment orders can be processed', 'CANNOT_PROCESS_PAID_ORDER');
    }
    const orderTotal = order.orderItems.reduce(
      (sum: number, item: any) => sum + item.product.price * item.items, 0
    );
    if (orderTotal > amount_usd) {
      throw new HttpException(
        400, 'Amount paid is less than the order total', 'AMOUNT_PAID_IS_LESS_THAN_ORDER_TOTAL'
      );
    }
    if (order.stripePaymentId) {
      // If something failed before, stripe will keep calling this for a while, so we need to ignore it
      logger.info('Order already has a stripe payment, ignoring');
      return;
    }
    await dbOrders.registerStripePayment(orderId, paymentIntentId);
    await payForOrderWithInternalWallet(order);
    logger.info('Successfully processed stripe payment for order ' + orderId);
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