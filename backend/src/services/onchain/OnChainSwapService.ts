import { SwapToken } from "@/lib/CofiblocksContracts/types";
import { ContractFactory } from "@/lib/CofiblocksContracts";
import { ChainClient } from "@/lib/CofiblocksContracts/ChainClient";
import { usdToWei } from "@/lib/CofiblocksContracts/utils";
import { HttpException } from "@/exceptions/HttpException";

const contractFactory = new ContractFactory();

export async function getSwapPrice(token: SwapToken, amountUSD: number): Promise<string> {
    const swapService = contractFactory.getSwapService();
    const amountUSDC = usdToWei(amountUSD);
    const result = await swapService.getSwapPrice(token, amountUSDC).call();
    return result.toString();
}

export async function swapTokenForUSDC(
    token: SwapToken, amountUSD: number, walletAddress: string
): Promise<ChainClient[]> {
    const swapService = contractFactory.getSwapService();
    const amountUSDC = usdToWei(amountUSD);
    let erc20Service;
    if (token === SwapToken.STRK) {
        erc20Service = contractFactory.getSTRKERC20Service();
    } else if (token === SwapToken.USDT) {
        erc20Service = contractFactory.getUSDTERC20Service();
    } else if (token === SwapToken.USDC_BRIDGED) {
        erc20Service = contractFactory.getUSDCBridgedERC20Service();
    } else {
        throw new Error("Invalid token");
    }
    const swapPrice = await swapService.getSwapPrice(token, amountUSDC).call();
    const balance = await erc20Service.getBalances(walletAddress).call();
    const swapPriceBigInt = BigInt(swapPrice.toString());
    if (BigInt(balance.toString()) < swapPriceBigInt) {
        throw new HttpException(400, 'Insufficient balance', 'INSUFFICIENT_BALANCE');
    }

    const allowanceTx = erc20Service.increaseAllowance(swapPriceBigInt, swapService.contractAddress);
    const swapTx = swapService.swapTokenForUSDC(token, amountUSDC);
    const claimTx = swapService.claimUSDC();

    const result = [
        allowanceTx, 
        swapTx, 
        claimTx
    ];
    return result;
}
