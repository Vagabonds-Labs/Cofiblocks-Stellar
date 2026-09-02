import { CofiBlocksContracts } from "../types";
import { getContractAddress } from "../utils";

export class CofiCollection {
    private contract: CofiBlocksContracts
	private network: string

    public contractAddress: string

    constructor(network: string) {
        this.contract = CofiBlocksContracts.COFI_COLLECTION
        this.network = network
        this.contractAddress = getContractAddress(this.network, this.contract)
    }
}