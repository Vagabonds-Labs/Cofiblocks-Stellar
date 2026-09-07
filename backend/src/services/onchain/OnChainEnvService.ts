import { ContractFactory } from '@/lib/StellarContracts';

const contractFactory = new ContractFactory();

export function getNetwork() {
    return contractFactory.getNetwork();
}

export function getMarketplaceAddress() {
    return contractFactory.getMarketplaceService().contractAddress;
}

export function getDistributionAddress() {
    return contractFactory.getDistributionService().contractAddress;
}

export function getUSDCAddress() {
    return contractFactory.getUSDCService().contractAddress;
}

export function getNetworkPassphrase() {
    return contractFactory.getClient().networkPassphrase;
}

export function getRpcUrl() {
    return contractFactory.getClient().deployment.rpcUrl;
}

/** Explorador de bloques. Reemplaza a Voyager. */
export function getExplorerURL(contractAddress: string) {
    const network = getNetwork() === 'mainnet' ? 'public' : 'testnet';
    return `https://stellar.expert/explorer/${network}/contract/${contractAddress}`;
}

/**
 * Datos que muestra el panel admin.
 *
 * Se cayeron `cofiCollection` y `swap`: esos contratos ya no existen. Los
 * totales ahora salen de getters del contrato, no de leer storage crudo con
 * selectores hardcodeados.
 */
export async function getStadisticsInContracts() {
    const distributionService = contractFactory.getDistributionService();
    const marketplaceService = contractFactory.getMarketplaceService();
    const usdcService = contractFactory.getUSDCService();

    const [totalProfit, totalPurchases, usdcBalance, epoch, run] = await Promise.all([
        distributionService.getTotalProfit(),
        distributionService.getTotalPurchases(),
        usdcService.balance(marketplaceService.contractAddress),
        distributionService.getEpoch(),
        distributionService.getRun(),
    ]);

    return {
        network: getNetwork(),
        distribution: {
            contractAddress: distributionService.contractAddress,
            url: getExplorerURL(distributionService.contractAddress),
            totalProfit: totalProfit.toString(),
            totalPurchases: totalPurchases.toString(),
            epoch,
            // Reparto en curso, si quedó uno a medias. `null` si no hay ninguno.
            run,
        },
        marketplace: {
            contractAddress: marketplaceService.contractAddress,
            url: getExplorerURL(marketplaceService.contractAddress),
            usdcBalance: usdcBalance.toString(),
        },
        usdc: {
            contractAddress: usdcService.contractAddress,
            issuer: usdcService.issuer,
            decimals: usdcService.decimals,
            url: getExplorerURL(usdcService.contractAddress),
        },
    };
}
