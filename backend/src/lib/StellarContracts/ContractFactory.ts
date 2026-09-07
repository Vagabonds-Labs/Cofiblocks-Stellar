import { StellarClient } from './StellarClient';
import { TxBuilder } from './TxBuilder';
import { TxSubmitter } from './TxSubmitter';
import { Distribution, Marketplace, Token } from './contracts';

/**
 * Fábrica de servicios de cadena.
 *
 * Conserva la forma de la `ContractFactory` de Starknet para que los servicios
 * de `services/onchain/` no tengan que cambiar cómo obtienen sus dependencias.
 * Se fueron `getCofiCollectionService()` y `getSwapService()`: esos contratos ya
 * no existen.
 */
export class ContractFactory {
  private readonly client: StellarClient;

  constructor(network?: string) {
    this.client = new StellarClient(network);
  }

  public getClient(): StellarClient {
    return this.client;
  }

  public getMarketplaceService(): Marketplace {
    return new Marketplace(this.client);
  }

  public getDistributionService(): Distribution {
    return new Distribution(this.client);
  }

  public getUSDCService(): Token {
    return new Token(this.client);
  }

  public getTxBuilder(): TxBuilder {
    return new TxBuilder(this.client);
  }

  public getTxSubmitter(): TxSubmitter {
    return new TxSubmitter(this.client);
  }

  public getNetwork(): string {
    return this.client.network;
  }
}
