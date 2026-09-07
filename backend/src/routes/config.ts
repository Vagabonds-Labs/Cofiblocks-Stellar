import { Router, Request, Response } from 'express';

import { successResponse } from '@/utils/formatting';
import * as OnChainEnvService from '@/services/onchain/OnChainEnvService';

const router = Router();

/**
 * GET /api/config/stellar
 *
 * Lo que el frontend necesita para conectar la wallet y firmar contra la red
 * correcta. Reemplaza a `GET /api/config/cavos`: ya no hay magic link, ni Google,
 * ni Apple — sólo login por wallet.
 */
router.get('/stellar', async (_req: Request, res: Response) => {
  successResponse(res, {
    network: OnChainEnvService.getNetwork(),
    networkPassphrase: OnChainEnvService.getNetworkPassphrase(),
    rpcUrl: OnChainEnvService.getRpcUrl(),
    contracts: {
      marketplace: OnChainEnvService.getMarketplaceAddress(),
      distribution: OnChainEnvService.getDistributionAddress(),
      usdc: OnChainEnvService.getUSDCAddress(),
    },
  });
});

export default router;
