import { HttpException } from "@/exceptions/HttpException";
import { ChainEventsClient, ContractFactory } from "@/lib/CofiblocksContracts";
import { ROLES } from "@/lib/CofiblocksContracts/types";
import { logger } from "@/lib/logger";

const contracts = new ContractFactory()
const chainEventsClient = new ChainEventsClient()

export async function assignRole(role: ROLES, walletAddress: string){
    const marketplaceService = contracts.getMarketplaceService()
    const result = await marketplaceService.assignRole(role, walletAddress).call()
    const transactionHash = (result as { transaction_hash?: string }).transaction_hash;
    if (!transactionHash) {
      throw new HttpException(500, 'Failed to assign role', 'FAILED_TO_ASSIGN_ROLE');
    }
    logger.info(`Assigned role ${role} to user ${walletAddress} on tx: ${transactionHash}`);

    // Wait for the transaction to be confirmed for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // We need to check if the role was assigned successfully
    const events = (await chainEventsClient.getTransactionEvents(transactionHash))
    // TODO: emit an event from the contract that we can check here.
    // For now, we can just check that the transaction was successful
    if (events.getIsError()) {
      throw new HttpException(400, 'Failed to assign role', 'FAILED_TO_ASSIGN_ROLE');
    }
    return transactionHash;
}