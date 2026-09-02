"use client";

import { connect, ConnectorData, StarknetWindowObject } from "starknetkit";
import { authService } from "@/services/auth/authService";
import { UnifiedWallet, UnifiedCall } from "./types";

class WalletService {
  // -------------------------------------------------
  // CHECK IF USER HAS A CONNECTED WALLET
  // -------------------------------------------------
  async isConnected(): Promise<boolean> {
    const user = authService.getCurrentUser();
    if (!user?.walletProvider) return false;

    if (user.walletProvider === "cavos") {
      return authService.isAuthenticated(); // cavos session defines connectivity
    }

    if (user.walletProvider === "starknet") {
      try {
        const { wallet, connectorData } = await connect({ modalMode: "neverAsk" });
        return Boolean(wallet && connectorData?.account);
      } catch {
        return false;
      }
    }

    return false;
  }

  async trySilent() {
    try {
      const { wallet, connectorData } = await connect({ modalMode: "neverAsk" })
      return wallet && connectorData?.account ? { wallet, connectorData } : null
    } catch {
      return null
    }
  }

  private async ensureSameWalletConnected(
    connectWalletWithoutSignature: () => Promise<{ 
      wallet: StarknetWindowObject | null, connectorData: ConnectorData | null 
    }>, disconnectWallet: () => Promise<void>
  ): Promise<{ wallet: StarknetWindowObject | null, connectorData: ConnectorData | null }> {
    const user = authService.getCurrentUser()
    if (user?.walletProvider === "cavos") {
      return { wallet: null, connectorData: null };
    }
    if (!user?.walletAddress) throw new Error("No wallet address found")
    const targetAddress = user.walletAddress.toLowerCase()

    // -------------------------------------------
    // 1. TRY SILENT RECONNECT
    // -------------------------------------------
    const silent = await this.trySilent()
    if (silent) {
      const connected = silent.connectorData?.account?.toLowerCase()
      if (connected === targetAddress) {
        return { wallet: silent.wallet, connectorData: silent.connectorData };
      }
      console.warn("Wallet mismatch, user wallet changed silently")
      await disconnectWallet()
    }

    const { wallet, connectorData } = await connectWalletWithoutSignature()
    if (!wallet || !connectorData?.account) {
      throw new Error("No wallet connected")
    }
    const connected = connectorData.account.toLowerCase()
    if (connected !== targetAddress) {
      throw new Error("Wallet mismatch, please connect the correct wallet")
    }
    return { wallet, connectorData };
  }

  async executeTransactions(
    calls: UnifiedCall[],
    connectWalletWithoutSignature: () => Promise<{ 
      wallet: StarknetWindowObject | null, connectorData: ConnectorData | null 
    }>, 
    disconnectWallet: () => Promise<void>,
    cavos?: { execute: Function },
  ): Promise<string> {
    if (!Array.isArray(calls)) {
      throw new Error("executeTransactions expects an array of calls");
    }

    const user = authService.getCurrentUser();
    if (!user?.walletProvider) throw new Error("No wallet provider found");
  
    let wallet: UnifiedWallet | null = null;
    if (user.walletProvider === "cavos") {
      wallet = await this.getCavosWallet(user.walletAddress!, cavos);
    }

    if (user.walletProvider === "starknet") {
      wallet = await this.getStarknetWallet(connectWalletWithoutSignature, disconnectWallet);
    }
    if (!wallet) throw new Error("No wallet available");
  
    return wallet.execute(calls);
  }
  

  // -------------------------------------------------
  // CAVOS WALLET WRAPPER
  // -------------------------------------------------
  private async getCavosWallet(address: string, cavos?: any): Promise<UnifiedWallet> {
    if (!cavos) throw new Error("Cavos instance missing");

    return {
      type: "cavos",
      address,
      execute: async (calls) => cavos.execute(calls, { gasless: true }),
    };
  }

  // -------------------------------------------------
  // STARKNET WALLET WRAPPER
  // -------------------------------------------------
  private async getStarknetWallet(
    connectWalletWithoutSignature: () => Promise<{ 
      wallet: StarknetWindowObject | null, connectorData: ConnectorData | null 
    }>, 
    disconnectWallet: () => Promise<void>
  ): Promise<UnifiedWallet> {
    const { wallet, connectorData } = await this.ensureSameWalletConnected(
      connectWalletWithoutSignature, disconnectWallet
    );

    if (!wallet) throw new Error("No StarkNet wallet connected");

    const activeAddress = connectorData?.account;
    if (!activeAddress) {
      throw new Error("Unable to determine connected StarkNet address");
    }

    return {
      type: "starknet",
      address: activeAddress,

      execute: async (calls) => {
        const arr = Array.isArray(calls) ? calls : [calls];

        const result = await wallet.request({
          type: "wallet_addInvokeTransaction",
          params: {
            calls: arr.map((c) => ({
              contract_address: c.contractAddress,
              entry_point: c.entrypoint,
              calldata: c.calldata,
            })),
          },
        });

        return result.transaction_hash;
      },
    };
  }
}

export const walletService = new WalletService();
