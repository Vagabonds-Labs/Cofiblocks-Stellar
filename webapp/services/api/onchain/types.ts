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

/** Roles cuyo saldo de reparto el usuario puede reclamar desde la app. */
export type ClaimableRole = 'CONSUMER' | 'PRODUCER' | 'ROASTER';

export interface RoleBalance {
    role: ClaimableRole;
    /** En stroops, como el resto de la API. */
    balance: string;
    /** El mismo monto en USD, ya convertido por el backend. */
    usd: number;
}

/**
 * Progreso del reparto de utilidades.
 *
 * Va de a páginas porque Soroban corta por presupuesto de recursos por
 * transacción. Con `done: false` hay que volver a llamar para continuar.
 */
export interface DistributionRunResponse {
    done: boolean;
    pages: number;
    txHashes: string[];
    run: {
        epoch: number;
        phase: number;
        cursor: number;
    } | null;
}

export type { PreparedTransaction };
