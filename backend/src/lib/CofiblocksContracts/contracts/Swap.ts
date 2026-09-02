import { CairoCustomEnum } from 'starknet';
import { CofiBlocksContracts, SwapToken, TransactionType } from "../types";
import { format_number, getContractAddress } from "../utils";
import { ChainClient } from "../ChainClient";

export class Swap {
    private contract: CofiBlocksContracts
	private network: string
    private tokenIdentifiers: Record<SwapToken, string>

    public contractAddress: string

    constructor(network: string) {
        this.contract = CofiBlocksContracts.SWAP
        this.network = network
        this.contractAddress = getContractAddress(network, this.contract)
        this.tokenIdentifiers = {
            [SwapToken.STRK]: "0x0",
            [SwapToken.USDC_BRIDGED]: "0x1",
            [SwapToken.USDT]: "0x2",
        }
    }

    public getSwapPrice(token: SwapToken, amountUSDC: bigint): ChainClient {
        const tokenEnum = new CairoCustomEnum({ [token]: {} });
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "get_swap_price",
            calldata: [tokenEnum, amountUSDC]
        }, TransactionType.READ);
    }


    public swapTokenForUSDC(token: SwapToken, amountUSDC: bigint): ChainClient {
        const formattedAmountUSDC = format_number(amountUSDC);
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "swap_token_for_usdc",
            calldata: [this.tokenIdentifiers[token], formattedAmountUSDC.low, formattedAmountUSDC.high]
        }, TransactionType.WRITE);
    }

    public swapTokenForAnyUSDC(token: SwapToken, tokenAmount: bigint): ChainClient {
        const formattedAmountUSDC = format_number(tokenAmount);
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "swap_token_for_any_usdc",
            calldata: [this.tokenIdentifiers[token], formattedAmountUSDC.low, formattedAmountUSDC.high]
        }, TransactionType.WRITE);
    }

    public claimUSDC(): ChainClient {
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "claim_usdc",
            calldata: []
        }, TransactionType.WRITE);
    }
}