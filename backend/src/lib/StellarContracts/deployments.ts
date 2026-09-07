/**
 * Direcciones de los contratos por red.
 *
 * Se sincroniza desde `contracts/deployments/<network>.json`, que emite
 * `contracts/scripts/deploy.sh`. Mantiene la forma que ya consumía
 * `getContractAddress()` para no propagar el cambio a los servicios.
 */
import { StellarContract } from './types/contracts';

export interface ContractEntry {
  contract: string;
  address: string;
}

export interface NetworkDeployment {
  network: string;
  networkPassphrase: string;
  rpcUrl: string;
  Marketplace: ContractEntry & { marketFeeBps: number };
  Distribution: ContractEntry;
  USDC: ContractEntry & { issuer: string; decimals: number };
}

const deployments: Record<string, NetworkDeployment> = {
  testnet: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    Marketplace: {
      contract: 'Marketplace',
      address: 'CC4HU6XKNG5PUYTNTTGCRGLGZG4X6FKUUHARA4GTKB4MKFK76KOOCEOG',
      marketFeeBps: 5000,
    },
    Distribution: {
      contract: 'Distribution',
      address: 'CAWOXN2MYZJWBDU6RCGIEB44W3LNIEPM66W6JQA6UUZ5KUBKKBHERSEB',
    },
    // En testnet el USDC de Circle no lo podemos emitir: se usa un activo propio
    // con los mismos 7 decimales.
    USDC: {
      contract: 'USDC',
      address: 'CDYIMMPF6SUKZWCHWIQ6ZGKYQ2KFOLUXL42Y5A6RWLMY7DB4RNVAHZJF',
      issuer: 'GBKTOBQYPPUT2PC6YGVCEMPS5NXQ6K6I2Q5SIE6I56G7QT5CDGSTHSHF',
      decimals: 7,
    },
  },
  mainnet: {
    network: 'mainnet',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    Marketplace: {
      contract: 'Marketplace',
      address: process.env.STELLAR_MARKETPLACE_ADDRESS ?? '',
      marketFeeBps: 5000,
    },
    Distribution: {
      contract: 'Distribution',
      address: process.env.STELLAR_DISTRIBUTION_ADDRESS ?? '',
    },
    // USDC de Circle. Verificado en 7 decimales contra la red.
    USDC: {
      contract: 'USDC',
      address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      decimals: 7,
    },
  },
};

export function getDeployment(network: string): NetworkDeployment {
  const deployment = deployments[network];
  if (!deployment) {
    throw new Error(`Unknown Stellar network: ${network}`);
  }
  return deployment;
}

export function getContractAddress(network: string, contract: StellarContract): string {
  const address = getDeployment(network)[contract].address;
  if (!address) {
    throw new Error(`No address configured for ${contract} on ${network}`);
  }
  return address;
}

export default deployments;
