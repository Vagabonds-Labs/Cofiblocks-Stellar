import { ContractFactory } from "@/lib/CofiblocksContracts";
import { usdToWei } from "@/lib/CofiblocksContracts/utils";

const contractFactory = new ContractFactory();

export function getNetwork() {
    return contractFactory.getNetwork();
}

export function getMarketplaceAddress() {
    return contractFactory.getMarketplaceService().contractAddress;
}

export function getCofiCollectionAddress() {
    return contractFactory.getCofiCollectionService().contractAddress;
}

export function getDistributionAddress() {
    return contractFactory.getDistributionService().contractAddress;
}

export function getVoyagerURL(contractAddress: string) {
    if (process.env.STARKNET_NETWORK === 'sepolia') {
        return `https://sepolia.voyager.online/contract/${contractAddress}`;
    }
    return `https://voyager.online/contract/${contractAddress}`;
}

export async function getStadisticsInContracts() {
    // get total profit from distribution contract
    const distributionService = contractFactory.getDistributionService();
    const totalProfit = await distributionService.getTotalProfit();
    const totalPurchases = await distributionService.getTotalPurchases();

    // get marketplace balance
    const marketplaceService = contractFactory.getMarketplaceService();
    const usdcService = contractFactory.getUSDCERC20Service();
    const usdcBalance = await usdcService.getBalances(marketplaceService.contractAddress).call();

    let swapBalance = "0";
    if (process.env.STARKNET_NETWORK === 'mainnet') {
        // Swap is only supported in mainnet
        const swapService = contractFactory.getSwapService();
        swapBalance = (await usdcService.getBalances(swapService.contractAddress).call()).toString();
    }

    return {
        distribution: {
            contractAddress: distributionService.contractAddress,
            url: getVoyagerURL(distributionService.contractAddress),
            totalProfit: totalProfit.toString(),
            totalPurchases: totalPurchases.toString(),
        },
        marketplace: {
            contractAddress: marketplaceService.contractAddress,
            url: getVoyagerURL(marketplaceService.contractAddress),
            usdcBalance: usdcBalance.toString(),
        },
        cofiCollection: {
            contractAddress: contractFactory.getCofiCollectionService().contractAddress,
            url: getVoyagerURL(contractFactory.getCofiCollectionService().contractAddress),
        },
        swap: {
            contractAddress: contractFactory.getSwapService().contractAddress,
            url: getVoyagerURL(contractFactory.getSwapService().contractAddress),
            usdcBalance: swapBalance.toString(),
        }
    }
}

export async function mintSepoliaUSDC(walletAddress: string) {
  if (process.env.STARKNET_NETWORK !== 'sepolia') {
    throw new Error('This function is only available in sepolia');
  }
  const usdcService = contractFactory.getUSDCERC20Service();
  const one_hundred_dolars = 100000000;
  await usdcService.mintToken(BigInt(one_hundred_dolars), walletAddress).call();
}

export async function getCavosConfig() {
    const marketplaceAddress = getMarketplaceAddress();
    const distributionAddress = getDistributionAddress();
    const swapAddress = contractFactory.getSwapService().contractAddress;
    const usdcAddress = contractFactory.getUSDCERC20Service().contractAddress;

    return {
        contracts: [
            marketplaceAddress, distributionAddress, swapAddress, usdcAddress,
        ],
        spendingLimits: [{
            token: usdcAddress,
            limit: usdToWei(1000).toString(),
        }]
    }
}
