'use client'

import { useEffect } from 'react'
import { connect } from 'starknetkit'

export function useWalletWatcher(
  user: any,
  isCavosAuthenticated: boolean,
  logoutCallback: () => void
) {
  useEffect(() => {
    if (!user?.walletProvider) return;

    const interval = setInterval(async () => {

      if (user.walletProvider === "cavos") {
        if (!isCavosAuthenticated) {
          console.warn("WalletWatcher: Cavos session expired");
          logoutCallback();
        }
        return;
      }

      if (user.walletProvider === "starknet") {
        let account: string | null = null;

        try {
          const result = await connect({ modalMode: "neverAsk" });
          account = result?.connectorData?.account ?? null;
        } catch (err) {
          console.error("WalletWatcher: Silent reconnect failed", err);
          //return logoutCallback();
        }

        if (!account) return;

        if (account.toLowerCase() !== user.walletAddress.toLowerCase()) {
          console.warn("WalletWatcher: Wallet mismatch");
          //return logoutCallback();
        }
      }

    }, 30000);

    return () => clearInterval(interval);
  }, [user, isCavosAuthenticated, logoutCallback]);
}

