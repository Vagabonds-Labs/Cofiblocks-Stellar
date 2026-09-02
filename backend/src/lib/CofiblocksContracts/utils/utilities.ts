import configExternalContracts from "../abi/deployedContracts";
import { CofiBlocksContracts } from "../types";

export function getContractAddress(network: string, contract: CofiBlocksContracts) {
    const env = (network) as keyof typeof configExternalContracts;
    return configExternalContracts[env][contract].address;
}

export function getPriceWithoutMarketplaceFee(price: number) {
    return price / 1.5; // 50% fee
}