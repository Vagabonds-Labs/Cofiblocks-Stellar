import { ContractFactory } from '@/lib/StellarContracts';
import { PaymentToken, PreparedTransaction } from '@/lib/StellarContracts/types/transactions';
import { usdToStroops } from '@/lib/StellarContracts/utils';
import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';

const contractFactory = new ContractFactory();

export interface WalletBalances {
    XLM: string;
    USDC: string;
}

/**
 * Balance de un token.
 *
 * Sólo quedan XLM y USDC: se fueron STRK, USDT y USDC.e junto con el contrato
 * de swap.
 */
export async function getBalanceOf(token: PaymentToken, walletAddress: string): Promise<string> {
    if (token === PaymentToken.USDC) {
        const usdc = contractFactory.getUSDCService();
        return (await usdc.balance(walletAddress)).toString();
    }
    return getNativeBalance(walletAddress);
}

/** XLM es un activo clásico: vive en Horizon, no en el storage de un contrato. */
async function getNativeBalance(walletAddress: string): Promise<string> {
    try {
        const account = await contractFactory.getClient().getHorizon().loadAccount(walletAddress);
        const native = account.balances.find((balance) => balance.asset_type === 'native');
        return native ? usdToStroops(Number(native.balance)).toString() : '0';
    } catch (error) {
        // Una cuenta que todavía no existe en la red no es un error de la app.
        logger.info({ walletAddress }, 'Account not found on Horizon, reporting zero balance');
        return '0';
    }
}

/**
 * ¿Tiene el usuario trustline a USDC?
 *
 * Sin ella no puede recibir USDC y el pago al vendedor falla dejando el saldo
 * atrapado en el contrato. Es la comprobación que reemplaza al "¿tiene gas?" de
 * Starknet.
 */
export async function hasUSDCTrustline(walletAddress: string): Promise<boolean> {
    const usdc = contractFactory.getUSDCService();
    try {
        const account = await contractFactory.getClient().getHorizon().loadAccount(walletAddress);
        return account.balances.some(
            (balance) =>
                balance.asset_type !== 'native' &&
                'asset_code' in balance &&
                balance.asset_code === 'USDC' &&
                balance.asset_issuer === usdc.issuer
        );
    } catch (error) {
        return false;
    }
}

export async function getWalletBalances(walletAddress: string): Promise<WalletBalances> {
    const [xlm, usdc] = await Promise.all([
        getBalanceOf(PaymentToken.XLM, walletAddress),
        getBalanceOf(PaymentToken.USDC, walletAddress),
    ]);
    return { XLM: xlm, USDC: usdc };
}

export async function canUserPayUSDC(walletAddress: string, amountUSD: number): Promise<boolean> {
    const balance = await getBalanceOf(PaymentToken.USDC, walletAddress);
    logger.info(`Balance of ${walletAddress} is ${balance}`);
    return BigInt(balance) >= usdToStroops(amountUSD);
}

export async function getClaimBalance(walletAddress: string): Promise<string> {
    const marketplace = contractFactory.getMarketplaceService();
    const balance = await marketplace.getSellerBalance(walletAddress);
    return balance.toString();
}

/**
 * Transferencia a una dirección externa.
 *
 * Ahora necesita la dirección de origen: en Stellar el usuario tiene que ser la
 * source account de su propia transacción.
 */
export async function withdraw(
    token: PaymentToken,
    amount: number,
    fromAddress: string,
    withdrawAddress: string
): Promise<PreparedTransaction> {
    if (token !== PaymentToken.USDC) {
        throw new HttpException(400, 'Only USDC withdrawals are supported', 'UNSUPPORTED_TOKEN');
    }
    const usdc = contractFactory.getUSDCService();
    return usdc.transfer(fromAddress, withdrawAddress, usdToStroops(amount));
}

/**
 * Cobro del vendedor.
 *
 * Ahora necesita la dirección: `withdraw_seller_balance` exige el `require_auth`
 * del vendedor, y el vendedor tiene que ser la source account.
 */
export async function claimSellerPayments(sellerWalletAddress: string): Promise<PreparedTransaction> {
    const marketplace = contractFactory.getMarketplaceService();
    return marketplace.withdrawSellerBalance(sellerWalletAddress);
}
