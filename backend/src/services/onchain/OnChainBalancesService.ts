import { PaymentToken } from "@/lib/CofiblocksContracts/types/transactions";
import { ContractFactory } from "@/lib/CofiblocksContracts";
import { ERC20Service } from "@/lib/CofiblocksContracts/contracts/ERC20";
import { starkToWei, usdToWei } from "@/lib/CofiblocksContracts/utils";
import { ChainClient } from "@/lib/CofiblocksContracts/ChainClient";
import { logger } from "@/lib/logger";

const contractFactory = new ContractFactory();

function getERC20contract(token: PaymentToken | 'USDC_BRIDGED'): ERC20Service {
    switch (token) {
        case PaymentToken.USDC:
            return contractFactory.getUSDCERC20Service();
        case PaymentToken.USDT:
            if (process.env.STARKNET_NETWORK === 'mainnet') {
                return contractFactory.getUSDTERC20Service();
            } else {
                // USDT is not supported in sepolia
                return contractFactory.getUSDCERC20Service();
            }
        case PaymentToken.STRK:
            return contractFactory.getSTRKERC20Service();
        case 'USDC_BRIDGED':
            return contractFactory.getUSDCBridgedERC20Service();
        default:
            throw new Error(`Unsupported token: ${token}`);
    }
}

export async function getBalanceOf(token: PaymentToken | 'USDC_BRIDGED', walletAddress: string): Promise<string> {
    const contract = getERC20contract(token);
    const balance = await contract.getBalances(walletAddress).call();
    return balance.toString();
}

export async function canUserPayUSDC(walletAddress: string, amountUSD: number): Promise<boolean> {
    const balance = await getBalanceOf(PaymentToken.USDC, walletAddress);
    logger.info(`Balance of ${walletAddress} is ${balance}`);
    return BigInt(balance) >= usdToWei(amountUSD);
}

export async function getClaimBalance(walletAddress: string): Promise<string> {
    const contract = contractFactory.getMarketplaceService();
    const balance = await contract.getSellerBalance(walletAddress).call();
    return balance.toString();
}

export async function withdraw(
    token: PaymentToken | 'USDC_BRIDGED', 
    amount: number, 
    withdrawAddress: string
): Promise<ChainClient> {
    const contract = getERC20contract(token);
    const formattedAmount = token === PaymentToken.STRK ? starkToWei(amount) : usdToWei(amount);
    const tx = await contract.transfer(formattedAmount, withdrawAddress);
    return tx;
}

export async function claimSellerPayments(): Promise<ChainClient> {
    const contract = contractFactory.getMarketplaceService();
    const tx = await contract.withdrawSellerBalance();
    return tx;
}