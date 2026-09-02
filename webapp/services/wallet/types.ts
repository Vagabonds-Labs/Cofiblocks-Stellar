export interface UnifiedCall {
    contractAddress: string;
    entrypoint: string;
    calldata: any[];
}
  
export interface UnifiedWallet {
    type: "cavos" | "starknet";
    address: string;
    execute: (calls: UnifiedCall | UnifiedCall[]) => Promise<string>;
}
  