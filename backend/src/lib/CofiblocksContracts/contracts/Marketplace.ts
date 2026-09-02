import { CairoCustomEnum } from 'starknet';
import { CofiBlocksContracts, ROLES, TransactionType } from "../types";
import { format_number, getContractAddress } from "../utils";
import { ChainClient } from "../ChainClient";

export class Marketplace {
    private contract: CofiBlocksContracts
	private network: string

    public contractAddress: string

    constructor(network: string) {
        this.contract = CofiBlocksContracts.MARKETPLACE
        this.network = network
        this.contractAddress = getContractAddress(network, this.contract)
    }

    private getRoleEnum(role: ROLES): CairoCustomEnum {
        let role_enum = "";
        if (role === ROLES.PRODUCER) {
            role_enum = "PRODUCER";
        } else if (role === ROLES.ROASTER) {
            role_enum = "ROASTER";
        } else if (role === ROLES.CAMBIATUS) {
            role_enum = "CAMBIATUS";
        } else if (role === ROLES.COFIBLOCKS) {
            role_enum = "COFIBLOCKS";
        } else if (role === ROLES.COFOUNDER) {
            role_enum = "COFOUNDER";
        } else {
            throw new Error("Invalid role");
        }
        return new CairoCustomEnum({ [role_enum]: {} });
    }

    public buyProduct(tokenId: bigint, tokenAmount: bigint, buyer: string): ChainClient {
        const formattedTokenId = format_number(tokenId);
        const formattedTokenAmount = format_number(tokenAmount);
        const calldata = [
            formattedTokenId.low,
            formattedTokenId.high,
            formattedTokenAmount.low,
            formattedTokenAmount.high,
            buyer,
        ];

        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "buy_product",
            calldata: calldata
        }, TransactionType.WRITE);
    }

    public createProduct(
        initialStock: bigint, price: bigint, associatedProducer: string, shortDescription: string
    ): ChainClient {
        if (price === 0n) {
            throw new Error("Price cannot be 0");
        }
        const formattedInitialStock = format_number(initialStock);
        const formattedPrice = format_number(price);
        const calldata = [
            formattedInitialStock.low,
            formattedInitialStock.high,
            formattedPrice.low,
            formattedPrice.high,
            associatedProducer,
            shortDescription,
        ];

        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "create_product",
            calldata: calldata
        }, TransactionType.WRITE);
    }

    public deleteProduct(tokenId: bigint): ChainClient {
        const formattedTokenId = format_number(tokenId);
        const calldata = [formattedTokenId.high, formattedTokenId.low];

        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "delete_product",
            calldata: calldata
        }, TransactionType.WRITE);
    }

    public withdrawDistributionBalance(role: ROLES): ChainClient {
        let role_enum = "";
        if (role === ROLES.PRODUCER) {
            role_enum = "0x0";
        } else if (role === ROLES.ROASTER) {
            role_enum = "0x1";
        } else if (role === ROLES.CAMBIATUS) {
            role_enum = "0x2";
        } else if (role === ROLES.COFIBLOCKS) {
            role_enum = "0x3";
        } else if (role === ROLES.COFOUNDER) {
            role_enum = "0x4";
        } else if (role === ROLES.CONSUMER) {
            role_enum = "0x5";
        } else {
            throw new Error("Invalid role");
        }
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: 'withdraw_distribution_balance',
            calldata: [role_enum]
        }, TransactionType.WRITE);
    }

    public assignRole(role: ROLES, account: string): ChainClient {
        const roleEnum = this.getRoleEnum(role);
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: 'assign_role',
            calldata: [roleEnum, account],
        }, TransactionType.WRITE);
    }

    public revokeRole(role: ROLES, account: string): ChainClient {
        const roleEnum = this.getRoleEnum(role);
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "account_revoke_role",
            calldata: [role, account]
        }, TransactionType.WRITE);
    }

    public withdrawSellerBalance(): ChainClient {
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "withdraw_seller_balance",
            calldata: [],
        }, TransactionType.WRITE);
    }

    public getSellerBalance(walletAddress: string): ChainClient {
        const calldata = [walletAddress];
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "get_seller_balance",
            calldata: calldata
        }, TransactionType.READ);
    }

    public addStock(tokenId: bigint, amount: bigint): ChainClient {
        const formattedTokenId = format_number(tokenId);
        const formattedAmount = format_number(amount);
        const calldata = [
            formattedTokenId.low, 
            formattedTokenId.high, 
            formattedAmount.low,
            formattedAmount.high
        ];
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "add_stock",
            calldata: calldata
        }, TransactionType.WRITE);
    }

    public getProduct(tokenId: bigint): ChainClient {
        const calldata = [tokenId];
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "get_product",
            calldata: calldata
        }, TransactionType.READ);
    }

    public getTokensByHolder(walletAddress: string): ChainClient {
        const calldata = [walletAddress];
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "get_tokens_by_holder",
            calldata: calldata
        }, TransactionType.READ);
    }

    public withdraw(amount: bigint, recipient: string): ChainClient {
        const formattedAmount = format_number(amount);
        const calldata = [formattedAmount.low, formattedAmount.high, recipient];
        return new ChainClient(this.network, {
            contract_address: this.contractAddress,
            entrypoint: "withdraw",
            calldata: calldata
        }, TransactionType.WRITE);
    }
}
