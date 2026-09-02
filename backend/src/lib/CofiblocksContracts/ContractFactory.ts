import { PaymentToken } from "./types"
import { Marketplace, ERC20Service } from "./contracts"
import { AccountService } from "./contracts/Account"
import { CofiCollection } from "./contracts/CofiCollection"
import { Distribution } from "./contracts/Distribution"
import { Swap } from "./contracts/Swap"

export class ContractFactory {
    private network: string

    constructor() {
        this.network = process.env.STARKNET_NETWORK ?? "mainnet"
        if (!this.network) {
            throw new Error("STARKNET_NETWORK is not set")
        }
    }

    public getSTRKERC20Service() {
        return new ERC20Service(this.network, PaymentToken.STRK)
    }

    public getUSDCERC20Service() {
        return new ERC20Service(this.network, PaymentToken.USDC)
    }

    public getUSDTERC20Service() {
        return new ERC20Service(this.network, PaymentToken.USDT)
    }

    public getUSDCBridgedERC20Service() {
        return new ERC20Service(this.network, 'USDC_BRIDGED')
    }

    public getMarketplaceService() {
        return new Marketplace(this.network)
    }

    public getCofiCollectionService() {
        return new CofiCollection(this.network)
    }

    public getDistributionService() {
        return new Distribution(this.network)
    }

    public getSwapService() {
        return new Swap(this.network)
    }

    public getAccountContract(accountAddress: string) {
        return new AccountService(this.network, accountAddress)
    }

    public getNetwork() {
        return this.network
    }
}