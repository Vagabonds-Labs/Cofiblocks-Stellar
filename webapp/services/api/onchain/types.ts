import { PreparedTransaction } from '@/types/contracts';

export interface BalanceResponse {
    wallet: string;
    balances: {
        XLM: string;
        USDC: string;
    };
    /**
     * Sin trustline a USDC la cuenta no puede recibirlo. El backend la
     * patrocina, así el usuario no necesita XLM para abrirla.
     */
    trustlines: {
        USDC: boolean;
    };
}

export interface TrustlineResponse {
    required: boolean;
    tx: PreparedTransaction | null;
}

export interface ContractsInfoResponse {
    network: string;
    distribution: {
        contractAddress: string;
        url: string;
        totalProfit: string;
        totalPurchases: string;
        epoch: number;
        /** Reparto en curso, si quedó uno a medias. */
        run: {
            epoch: number;
            phase: number;
            cursor: number;
            total_profit: string;
            total_purchases: string;
        } | null;
    };
    marketplace: {
        contractAddress: string;
        url: string;
        usdcBalance: string;
    };
    usdc: {
        contractAddress: string;
        issuer: string;
        decimals: number;
        url: string;
    };
}

export type { PreparedTransaction };
