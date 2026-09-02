export interface BalanceResponse {    
    wallet: string;
    balances: {
        STRK: string;
        USDC: string;
        USDT: string;
        USDC_BRIDGED: string;
   };
}

export interface TransactionDetails {
  contract_address: string;
  entrypoint: string;
  calldata: any[];
}

export enum TransactionType {
  READ = 'read',
  WRITE = 'write',
}

export interface TransactionResponse {
  tx: TransactionDetails;
  tx_type: TransactionType;
}

export interface ContractsInfoResponse {
  distribution: {
    contractAddress: string;
    url: string;
    totalProfit: string;
    totalPurchases: string;
  };
  marketplace: {
    contractAddress: string;
    url: string;
    usdcBalance: string;
  };
  cofiCollection: {
    contractAddress: string;
    url: string;
  };
  swap: {
    contractAddress: string;
    url: string;
    usdcBalance: string;
  };
}
