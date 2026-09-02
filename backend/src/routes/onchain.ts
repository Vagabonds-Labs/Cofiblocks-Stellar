import { Router, Request, Response } from 'express';

import { HttpException } from '@/exceptions/HttpException';
import { authenticate, requireAdmin, validate } from '@/middleware';
import { parseEventSchema, swapSchema, withdrawSchema } from '@/schemas/onchain';
import { PaymentToken, SwapToken } from '@/lib/CofiblocksContracts/types';
import { ChainEventsClient } from '@/lib/CofiblocksContracts';
import * as OnChainBalancesService from '@/services/onchain/OnChainBalancesService';
import * as OnChainProductsService from '@/services/onchain/OnChainProductsService';
import { isSameAddress } from '@/lib/CofiblocksContracts/utils';
import { successResponse } from '@/utils/formatting';
import * as OnChainEnvService from '@/services/onchain/OnChainEnvService';
import * as OnChainSwapService from '@/services/onchain/OnChainSwapService';

const router = Router();

/**
 * GET /api/onchain/balance_of
 * Get balance for a wallet address
 * Query parameter: wallet (optional) - if not provided, uses authenticated user's wallet
 * Requires authentication
 */
router.get('/balance_of', authenticate, async (req: Request, res: Response, next) => {
  const { wallet } = req.query;
  const { walletAddress: userWalletAddress } = req.user!;

  let walletAddressToLook: string;

  // If wallet query parameter is provided, use it
  if (wallet && typeof wallet === 'string') {
    walletAddressToLook = wallet;
  } else if (userWalletAddress) {
    walletAddressToLook = userWalletAddress;
  } else {
    throw new HttpException(400, 'Wallet address is required', 'MISSING_WALLET_ADDRESS');
  }

  const strkbalance = await OnChainBalancesService.getBalanceOf(PaymentToken.STRK, walletAddressToLook);
  const usdcBalance = await OnChainBalancesService.getBalanceOf(PaymentToken.USDC, walletAddressToLook);
  const usdtBalance = await OnChainBalancesService.getBalanceOf(PaymentToken.USDT, walletAddressToLook);
  const usdcBridgedBalance = await OnChainBalancesService.getBalanceOf('USDC_BRIDGED', walletAddressToLook);

  const data = {
    wallet: walletAddressToLook,
    balances: {
      STRK: strkbalance,
      USDC: usdcBalance,
      USDT: usdtBalance,
      USDC_BRIDGED: usdcBridgedBalance,
    },
  };

  successResponse(res, data);
});

router.post('/events',  validate(parseEventSchema), async (req: Request, res: Response, next) => {
  const { tx_hash, tx_type } = req.body;
  const chainEventsClient = new ChainEventsClient();
  const events = (await chainEventsClient.getTransactionEvents(tx_hash)).parseEvents(tx_type);

  const data = { tx_hash, events };
  successResponse(res, data);
});

router.post('/withdraw', authenticate, validate(withdrawSchema), async (req: Request, res: Response, next) => {
  const { walletAddress } = req.user!;
  const { token, amount, withdrawAddress } = req.body;
  if (isSameAddress(walletAddress, withdrawAddress)) {
    throw new HttpException(400, 'You cannot withdraw to your own address', 'INVALID_WITHDRAW_ADDRESS');
  }
  const tx = await OnChainBalancesService.withdraw(token, amount, withdrawAddress);
  successResponse(res, {tx: tx.getTransactionDetails(), tx_type: tx.getTransactionType()});
});

router.get('/contracts_info', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  const contractsInfo = await OnChainEnvService.getStadisticsInContracts();
  successResponse(res, contractsInfo);
});

router.get('/mint_sepolia_usdc', authenticate, async (req: Request, res: Response, next) => {
  const { walletAddress } = req.user!;
  await OnChainEnvService.mintSepoliaUSDC(walletAddress);
  successResponse(res, { message: 'USDC minted successfully' });
});

router.get('/product/:tokenId', async (req: Request, res: Response, next) => {
  const { tokenId } = req.params;
  const product = await OnChainProductsService.getProduct(tokenId);
  successResponse(res, product);
});

router.get('/swap_price', async (req: Request, res: Response, next) => {
  const { token, amount } = req.query;
  if (!Object.values(SwapToken).includes(token as SwapToken)) {
    throw new HttpException(400, 'Invalid token', 'INVALID_TOKEN');
  }
  if (isNaN(Number(amount))) {
    throw new HttpException(400, 'Invalid amount', 'INVALID_AMOUNT');
  }
  const price = await OnChainSwapService.getSwapPrice(token as SwapToken, Number(amount));
  successResponse(res, price);
});

router.post('/swap', authenticate, validate(swapSchema), async (req: Request, res: Response, next) => {
  const { token, amount } = req.body;
  const { walletAddress } = req.user!;
  const txs = await OnChainSwapService.swapTokenForUSDC(token as SwapToken, Number(amount), walletAddress);
  const result = txs.map(
    tx => ({tx: tx.getTransactionDetails(), tx_type: tx.getTransactionType()})
  );
  successResponse(res, result);
});


export default router;
