import { Router, Request, Response } from 'express';

import { authenticate, validate } from '@/middleware';
import { successResponse } from '@/utils/formatting';
import * as SellsService from '@/services/app/SellsService';
import * as OnChainBalancesService from '@/services/onchain/OnChainBalancesService';
import { claimCallbackSchema } from '@/schemas/sellsSchemas';
import { logger } from '@/lib/logger';
import * as UsersService from '@/services/app/UsersService';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;

  const sales = await SellsService.getSalesByUser(userId);
  
  logger.info({ userId, salesCount: sales.length }, 'Successfully retrieved user sales');
  successResponse(res, sales, 'Sales fetched successfully', 200);
});

router.get('/:id/confirm_delivery', authenticate, async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;
  const orderId = req.params.id;

  await SellsService.confirmDelivery(userId, orderId);
  
  logger.info({ userId, orderId }, 'Successfully confirmed delivery');
  successResponse(res, { message: 'Delivery confirmed successfully' }, 'Delivery confirmed successfully', 200);
});

router.get('/claim_balance', authenticate, async (req: Request, res: Response, next) => {
  const { walletAddress } = req.user!;
  
  const balance = await OnChainBalancesService.getClaimBalance(walletAddress);
  successResponse(res, balance);
});

router.get('/claim', authenticate, async (req: Request, res: Response, next) => {
  const { walletAddress } = req.user!;
  const tx = await SellsService.getClaimTx(walletAddress);
  successResponse(res, tx, 'Claim transaction fetched successfully', 200);
});

router.post('/claim/callback', authenticate, validate(claimCallbackSchema), async (req: Request, res: Response, next) => {
  const { signed_xdr } = req.body;
  const { walletAddress, userId } = req.user!;
  logger.info('Received claim callback request for user ' + userId);
  await SellsService.claimCallback(userId, walletAddress, signed_xdr);
  successResponse(res, null, 'Claim transaction fetched successfully', 200);
});

router.get('/:id', authenticate, async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;
  const orderId = req.params.id;

  const sale = await SellsService.getSaleByOrderId(userId, orderId);
  const buyer_entry = await UsersService.getUserById(sale.buyerId);
  const buyerName = buyer_entry?.name;
  const buyerEmail = buyer_entry?.email;
  const buyerWalletAddress = buyer_entry?.walletAddress;

  const result = {
    ...sale,
    buyerName,
    buyerEmail,
    buyerWalletAddress,
  }
  
  logger.info({ userId, orderId }, 'Successfully retrieved sale');
  successResponse(res, result, 'Sale fetched successfully', 200);
});


export default router;

