import { Router, Request, Response } from 'express';

import { HttpException } from '@/exceptions/HttpException';
import { authenticate, requireAdmin, validate } from '@/middleware';
import {
  distributionClaimCallbackSchema,
  distributionClaimSchema,
  parseEventSchema,
  submitSignedSchema,
  withdrawSchema,
} from '@/schemas/onchain';
import { EventsClient } from '@/lib/StellarContracts';
import { isSameAddress } from '@/lib/StellarContracts/utils';
import * as OnChainAccountsService from '@/services/onchain/OnChainAccountsService';
import * as OnChainBalancesService from '@/services/onchain/OnChainBalancesService';
import * as OnChainDistributionService from '@/services/onchain/OnChainDistributionService';
import * as OnChainEnvService from '@/services/onchain/OnChainEnvService';
import * as OnChainProductsService from '@/services/onchain/OnChainProductsService';
import { successResponse } from '@/utils/formatting';

const router = Router();

/**
 * GET /api/onchain/balance_of
 * Balances de una wallet. Query opcional `wallet`; si no viene, la del token.
 *
 * Sólo XLM y USDC: se fueron STRK, USDT y USDC.e junto con el swap. Se agrega
 * `trustlines`, porque sin trustline a USDC la cuenta no puede recibirlo.
 */
router.get('/balance_of', authenticate, async (req: Request, res: Response, next) => {
  const { wallet } = req.query;
  const { walletAddress: userWalletAddress } = req.user!;

  let walletAddressToLook: string;

  if (wallet && typeof wallet === 'string') {
    walletAddressToLook = wallet;
  } else if (userWalletAddress) {
    walletAddressToLook = userWalletAddress;
  } else {
    throw new HttpException(400, 'Wallet address is required', 'MISSING_WALLET_ADDRESS');
  }

  const [balances, hasUsdcTrustline] = await Promise.all([
    OnChainBalancesService.getWalletBalances(walletAddressToLook),
    OnChainBalancesService.hasUSDCTrustline(walletAddressToLook),
  ]);

  successResponse(res, {
    wallet: walletAddressToLook,
    balances,
    trustlines: { USDC: hasUsdcTrustline },
  });
});

router.post('/events', validate(parseEventSchema), async (req: Request, res: Response, next) => {
  const { tx_hash, tx_type } = req.body;
  const eventsClient = new EventsClient();
  const events = (await eventsClient.getTransactionEvents(tx_hash)).parseEvents(tx_type);

  const data = { tx_hash, events };
  successResponse(res, data);
});

router.post('/withdraw', authenticate, validate(withdrawSchema), async (req: Request, res: Response, next) => {
  const { walletAddress } = req.user!;
  const { token, amount, withdrawAddress } = req.body;
  if (isSameAddress(walletAddress, withdrawAddress)) {
    throw new HttpException(400, 'You cannot withdraw to your own address', 'INVALID_WITHDRAW_ADDRESS');
  }
  const tx = await OnChainBalancesService.withdraw(token, amount, walletAddress, withdrawAddress);
  successResponse(res, tx);
});

/**
 * Trustline a USDC patrocinada por el backend.
 *
 * La cuenta necesita la trustline para poder recibir USDC, y abrirla inmoviliza
 * reservas en XLM. Las pone el backend, así el usuario no necesita XLM.
 */
router.get('/usdc_trustline', authenticate, async (req: Request, res: Response, next) => {
  const { walletAddress } = req.user!;
  const alreadyHasIt = await OnChainBalancesService.hasUSDCTrustline(walletAddress);
  if (alreadyHasIt) {
    successResponse(res, { required: false, tx: null }, 'USDC trustline already exists', 200);
    return;
  }
  const tx = await OnChainAccountsService.buildSponsoredUSDCTrustlineTx(walletAddress);
  successResponse(res, { required: true, tx });
});

router.post(
  '/usdc_trustline/callback',
  authenticate,
  validate(submitSignedSchema),
  async (req: Request, res: Response, next) => {
    const { signed_xdr } = req.body;
    const txHash = await OnChainAccountsService.submitSponsoredTrustline(signed_xdr);
    successResponse(res, { tx_hash: txHash }, 'USDC trustline created', 200);
  }
);

/**
 * POST /api/onchain/distribution/run
 * Avanza el reparto de utilidades.
 *
 * Va de a páginas porque Soroban corta por presupuesto de recursos, y corta
 * también por request para no dejar la llamada colgada. Si vuelve
 * `done: false`, hay que volver a llamar: el cursor vive en el contrato, así
 * que retomar es seguro aunque el request se haya caído en el medio.
 */
router.post('/distribution/run', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  const result = await OnChainDistributionService.runDistribution();
  const message = result.done ? 'Distribution completed' : 'Distribution advanced';
  successResponse(res, result, message, 200);
});

/**
 * GET /api/onchain/distribution/claim_balance
 * Saldos de reparto del usuario, uno por cada rol que tiene.
 */
router.get('/distribution/claim_balance', authenticate, async (req: Request, res: Response, next) => {
  const { walletAddress, is_producer, is_roaster } = req.user!;
  const balances = await OnChainDistributionService.getClaimBalances(walletAddress, {
    is_producer,
    is_roaster,
  });
  successResponse(res, { balances });
});

/**
 * GET /api/onchain/distribution/claim?role=CONSUMER
 * Transacción para reclamar. La firma el usuario: el contrato le transfiere el
 * USDC al `caller`, así que tiene que autorizar él.
 */
router.get(
  '/distribution/claim',
  authenticate,
  validate(distributionClaimSchema),
  async (req: Request, res: Response, next) => {
    const { walletAddress, is_producer, is_roaster } = req.user!;
    const role = req.query.role as OnChainDistributionService.SelfClaimableRole;

    OnChainDistributionService.assertUserHoldsRole(role, { is_producer, is_roaster });
    const tx = await OnChainDistributionService.claimTx(role, walletAddress);
    successResponse(res, tx);
  }
);

router.post(
  '/distribution/claim/callback',
  authenticate,
  validate(distributionClaimCallbackSchema),
  async (req: Request, res: Response, next) => {
    const { walletAddress, is_producer, is_roaster } = req.user!;
    const { role, signed_xdr } = req.body;

    OnChainDistributionService.assertUserHoldsRole(role, { is_producer, is_roaster });
    const txHash = await OnChainDistributionService.submitClaim(role, walletAddress, signed_xdr);
    successResponse(res, { tx_hash: txHash }, 'Distribution balance claimed', 200);
  }
);

/**
 * POST /api/onchain/testnet_usdc
 *
 * 100 USDC de prueba para la cuenta del usuario. Sólo en testnet: reemplaza al
 * botón "Get $100 Sepolia Tokens" de Starknet.
 */
router.post('/testnet_usdc', authenticate, async (req: Request, res: Response, next) => {
  const { walletAddress } = req.user!;
  const result = await OnChainAccountsService.sendTestnetUSDC(walletAddress);
  successResponse(res, result, 'Test USDC sent', 200);
});

router.get('/contracts_info', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  const contractsInfo = await OnChainEnvService.getStadisticsInContracts();
  successResponse(res, contractsInfo);
});

router.get('/product/:tokenId', async (req: Request, res: Response, next) => {
  const { tokenId } = req.params;
  const product = await OnChainProductsService.getProduct(tokenId);
  successResponse(res, product);
});

/**
 * Extiende el TTL de un producto para que el state archival no lo archive.
 * Es la restauración que el panel admin necesita y que Starknet no requería.
 */
router.post('/product/:tokenId/touch', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  const { tokenId } = req.params;
  const txHash = await OnChainProductsService.touchProduct(tokenId);
  successResponse(res, { tx_hash: txHash }, 'Product TTL extended', 200);
});

export default router;
