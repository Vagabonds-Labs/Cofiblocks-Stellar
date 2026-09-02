import { ChainClient } from "../ChainClient";
import { CofiBlocksContracts } from "../types";
import { getContractAddress } from "../utils";

export class Distribution {
    private contract: CofiBlocksContracts
	private network: string

    public contractAddress: string

    constructor(network: string) {
        this.contract = CofiBlocksContracts.DISTRIBUTION
        this.network = network
        this.contractAddress = getContractAddress(this.network, this.contract)
    }

    public async getTotalProfit() {
        const chainClient = new ChainClient(this.network, null, null);
        const total_profit_selector = "0x01a31d9be706f775746b637fb0ee344964024e09a8bffef4b6997b1f04489c01";
        const hex_value = await chainClient.readStorageAt(this.contractAddress, total_profit_selector);
        return BigInt(hex_value);
    }

    public async getTotalPurchases() {
        const chainClient = new ChainClient(this.network, null, null);
        const total_purchases_selector = "0x0156264820eda27528fa6dbc638e386aea8ed45c586d7efc360ddc58d8ae7bcc";
        const hex_value = await chainClient.readStorageAt(this.contractAddress, total_purchases_selector);
        return BigInt(hex_value);
    }
}