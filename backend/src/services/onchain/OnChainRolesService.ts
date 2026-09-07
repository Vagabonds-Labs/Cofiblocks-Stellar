import { HttpException } from '@/exceptions/HttpException';
import { ContractFactory, EventsClient } from '@/lib/StellarContracts';
import { ROLES } from '@/lib/StellarContracts/types';
import { isSameAddress } from '@/lib/StellarContracts/utils';
import { logger } from '@/lib/logger';

const contracts = new ContractFactory();
const eventsClient = new EventsClient();

/**
 * Asigna un rol on-chain. La firma el backend, que es el admin del contrato.
 *
 * A diferencia de Starknet, no hace falta esperar 5 segundos a ciegas: el submit
 * hace polling hasta la confirmación y después se verifica el evento
 * `assign_role`, que es lo que el TODO del código anterior dejaba pendiente.
 */
export async function assignRole(role: ROLES, walletAddress: string): Promise<string> {
    const marketplace = contracts.getMarketplaceService();
    const tx = await marketplace.assignRole(role, walletAddress);
    const { hash } = await contracts.getTxSubmitter().submitAsService(tx);
    logger.info(`Assigned role ${role} to user ${walletAddress} on tx: ${hash}`);

    const event = (await eventsClient.getTransactionEvents(hash)).parseAssignRoleEvents();
    if (event.role !== role || !isSameAddress(event.account, walletAddress)) {
      logger.error({ event, role, walletAddress }, 'assign_role event does not match the request');
      throw new HttpException(400, 'Failed to assign role', 'FAILED_TO_ASSIGN_ROLE');
    }
    return hash;
}

export async function revokeRole(role: ROLES, walletAddress: string): Promise<string> {
    const marketplace = contracts.getMarketplaceService();
    const tx = await marketplace.revokeRole(role, walletAddress);
    const { hash } = await contracts.getTxSubmitter().submitAsService(tx);
    logger.info(`Revoked role ${role} from user ${walletAddress} on tx: ${hash}`);
    return hash;
}

export async function accountHasRole(role: ROLES, walletAddress: string): Promise<boolean> {
    return contracts.getMarketplaceService().accountHasRole(role, walletAddress);
}
