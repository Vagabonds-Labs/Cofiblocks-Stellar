import { Router, Request, Response } from 'express';

import { successResponse } from '@/utils/formatting';
import { getCavosConfig } from '@/services/onchain/OnChainEnvService';

const router = Router();

interface RawSpendingLimit {
  token: string;
  limit: string | number;
}

function parseJsonArray<T>(value: string | undefined, fallback: T[]): T[] {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

router.get('/cavos', async (_req: Request, res: Response) => {
  const cavosConfig = await getCavosConfig();
  const { contracts, spendingLimits } = cavosConfig;

  const starknetNetwork = process.env.STARKNET_NETWORK === 'sepolia' ? 'sepolia' : 'mainnet';

  successResponse(res, {
    appId: process.env.CAVOS_APP_ID ?? '',
    network: starknetNetwork,
    starknetRpcUrl: process.env.RPC_URL ?? '',
    paymasterApiKey: process.env.CAVOS_API_KEY ?? '',
    session: {
      defaultPolicy: {
        allowedContracts: contracts,
        maxCallsPerTx: 5,
        spendingLimits,
      },
    },
  });
});

export default router;
