import { Router, Request, Response } from 'express';

import { authenticate, requireAdmin, validate } from '@/middleware';
import { getAdminOrdersSchema, type GetAdminOrdersQuery } from '@/schemas/orderSchemas';
import * as AdminService from '@/services/app/AdminService';
import * as SellsService from '@/services/app/SellsService';
import { successResponse } from '@/utils/formatting';
import { logger } from '@/lib/logger';
import * as OrdersService from '@/services/app/OrdersService';
import * as UsersService from '@/services/app/UsersService';

const router = Router();

router.post('/orders', authenticate, requireAdmin, validate(getAdminOrdersSchema), async (req: Request, res: Response, next) => {
  const query = req.body as unknown as GetAdminOrdersQuery;
  logger.info('Getting orders with filters: ' + JSON.stringify(query));
  
  const orders = await AdminService.getOrders({
    status: query.status,
    buyerId: query.buyer_id,
    productId: query.product_id,
    deliveryMethod: query.delivery_method,
    eventId: query.event_id,
    startDate: query.start_date,
    endDate: query.end_date,
  });
  
  successResponse(res, orders);
});

router.get('/orders/:orderId/mark-as-delivered', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  const { orderId } = req.params;
  const userId = req.user!.userId;

  const sellers = await SellsService.getOrderSellers(orderId);
  sellers.map(async (seller) => {
    await SellsService.confirmDelivery(seller, orderId);
  });
  
  logger.info({ userId, orderId }, 'Successfully confirmed delivery');
  successResponse(res, { message: 'Delivery confirmed successfully' }, 'Delivery confirmed successfully', 200);
});

router.get('/orders/:orderId', authenticate, requireAdmin, async (req: Request, res: Response, next) => { 
  const { orderId } = req.params;
  const order = await OrdersService.getOrderById(orderId, req.user!.userId, true);
  const buyer_entry = await UsersService.getUserById(order.buyerId);
  const buyerName = buyer_entry?.name;
  const buyerEmail = buyer_entry?.email;
  const buyerWalletAddress = buyer_entry?.walletAddress;

  const result = {
    ...order,
    buyerName,
    buyerEmail,
    buyerWalletAddress,
  }
  successResponse(res, result, 'Order fetched successfully', 200);
});

export default router;