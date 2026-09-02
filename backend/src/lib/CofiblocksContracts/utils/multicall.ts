import { Account, RpcProvider } from "starknet";
import { ChainClient } from "../ChainClient";


const provider = new RpcProvider({
    nodeUrl: process.env.RPC_URL
});

export async function multicall(address: string, private_key: string, calls: ChainClient[]): Promise<string> {
    const account = new Account(
        {
            provider: provider,
            address: address,
            signer: private_key,
        }
    );
    const callsRaw = calls.map((call) => ({
        contractAddress: call.getTransactionDetails().contract_address,
        entrypoint: call.getTransactionDetails().entrypoint,
        calldata: call.getTransactionDetails().calldata,
    }));
    const tx = await account.execute(callsRaw);
    return tx.transaction_hash;
}
