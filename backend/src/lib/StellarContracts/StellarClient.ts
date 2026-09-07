import { Horizon, Keypair, rpc } from '@stellar/stellar-sdk';

import { getDeployment, NetworkDeployment } from './deployments';

/**
 * Punto único de acceso a la red: RPC de Soroban, Horizon y la cuenta con la
 * que el backend firma (asignación de roles, fee-bumps y patrocinio de
 * trustlines).
 */
export class StellarClient {
	public readonly network: string;
	public readonly deployment: NetworkDeployment;
	public readonly networkPassphrase: string;
	public readonly rpc: rpc.Server;

	private static horizonServer: Horizon.Server | null = null;

	constructor(network?: string) {
		this.network = network ?? process.env.STELLAR_NETWORK ?? 'mainnet';
		this.deployment = getDeployment(this.network);
		this.networkPassphrase = this.deployment.networkPassphrase;
		this.rpc = new rpc.Server(process.env.STELLAR_RPC_URL ?? this.deployment.rpcUrl);
	}

	/**
	 * Cuenta del backend. Paga los fees vía fee-bump, patrocina las trustlines de
	 * USDC y es el admin de los contratos.
	 */
	public getServiceKeypair(): Keypair {
		const secret = process.env.STELLAR_ADMIN_SECRET;
		if (!secret) {
			throw new Error('STELLAR_ADMIN_SECRET is not set');
		}
		return Keypair.fromSecret(secret);
	}

	public getServiceAddress(): string {
		return this.getServiceKeypair().publicKey();
	}

	/** Horizon hace falta para balances clásicos y trustlines; el RPC no los expone. */
	public getHorizon(): Horizon.Server {
		if (!StellarClient.horizonServer) {
			const url =
				process.env.STELLAR_HORIZON_URL ??
				(this.network === 'mainnet'
					? 'https://horizon.stellar.org'
					: 'https://horizon-testnet.stellar.org');
			StellarClient.horizonServer = new Horizon.Server(url);
		}
		return StellarClient.horizonServer;
	}
}
