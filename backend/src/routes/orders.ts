import { OrderStatus } from '@prisma/client';
import { Router, Request, Response } from 'express';

import { authenticate, validate } from '@/middleware';
import { HttpException } from '@/exceptions/HttpException';
import { createOrderSchema, getHomeDeliveryPriceSchema, checkoutOrderSchema, checkoutOrderCallbackSchema, getOrdersSchema } from '@/schemas/orderSchemas';
import { successResponse } from '@/utils/formatting';
import { logger } from '@/lib/logger';
import * as OrdersService from '@/services/app/OrdersService';
import * as ProductService from '@/services/app/ProductService';
import * as DeliveryService from '@/services/app/DeliveryService';

const router = Router();


router.post('/create', authenticate, validate(createOrderSchema), async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;
  const { products } = req.body;

  await ProductService.assertProductsArePurchasable({products: products});
  const orderId = await OrdersService.createOrder(userId, {products: products});
  
  successResponse(res, { order_id: orderId }, 'Order created successfully', 201);
});

router.get('/', authenticate, validate(getOrdersSchema), async (req: Request, res: Response, next) => {
  const { status } = req.query as { status?: OrderStatus[] };
  const userId = req.user!.userId;
  const orders = await OrdersService.getOrdersByUser(userId, status);
  successResponse(res, orders, 'Orders fetched successfully', 200);
});

router.delete('/:orderId', authenticate, async (req: Request, res: Response, next) => {
  const { orderId } = req.params;
  const userId = req.user!.userId;
  await OrdersService.deletePendingPaymentOrder(orderId, userId);
  successResponse(res, null, 'Order deleted successfully', 200);
});


router.post(
  '/get_home_delivery_price',
  validate(getHomeDeliveryPriceSchema),
  async (req: Request, res: Response, next) => {
    const { state } = req.body;
    const price = DeliveryService.calculateHomeDeliveryPrice(state);
    successResponse(res, { price }, 'Home delivery price fetched successfully', 200);
  }
);


router.post('/checkout', authenticate, validate(checkoutOrderSchema), async (req: Request, res: Response, next) => {
  const { userId, walletAddress } = req.user!;
  const payload = req.body;

  const deliveryEntry = await DeliveryService.buildDeliveryEntry(payload.delivery_event_id, payload.delivery_home);
  const { tx } = await OrdersService.createRequestOrderPayment(
    userId, walletAddress, payload, deliveryEntry);

  // Una sola transacción para firmar, no un multicall.
  successResponse(res, tx, 'Order checked out successfully', 200);
});

router.post(
  '/checkout/callback',
  authenticate, 
  validate(checkoutOrderCallbackSchema), 
  async (req: Request, res: Response, next) => 
{
  const { id, signed_xdr } = req.body;
  logger.info('Received checkout callback request for order ' + id);
  // El backend envía la transacción firmada y saca el hash del submit.
  const order = await OrdersService.verifyOrderPayment(id, signed_xdr);

  successResponse(res, order, 'Order checked out successfully', 200);
});

router.get('/:orderId/items', authenticate, async (req: Request, res: Response, next) => {
  const { status } = req.query;
  const { orderId } = req.params;
  const userId = req.user!.userId;

  // Validate orderId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orderId)) {
    throw new HttpException(400, 'Invalid order ID format', 'INVALID_ORDER_ID_FORMAT');
  }

  const orderItems = await OrdersService.getOrderItems(orderId, userId, status as OrderStatus | undefined);
  
  successResponse(res, orderItems, 'Order items fetched successfully', 200);
});

router.get('/latest', authenticate, async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;
  const order = await OrdersService.getLatestOrder(userId);
  successResponse(res, order, 'Latest order fetched successfully', 200);
});

router.get('/:orderId', authenticate, async (req: Request, res: Response, next) => {
  const { orderId } = req.params;
  const userId = req.user!.userId;
  const order = await OrdersService.getOrderById(orderId, userId);
  successResponse(res, order, 'Order fetched successfully', 200);
});

export default router;