import { TransactionType} from "../types";
import { ChainClient } from '../ChainClient';

// Minimal ABI for isValidSignature
const ACCOUNT_ABI = [
    {
      name: 'is_valid_signature',
      type: 'function',
      inputs: [
        { name: 'hash', type: 'felt' },
        { name: 'signature', type: 'felt*' },
      ],
      outputs: [{ name: 'isValid', type: 'felt' }],
      state_mutability: 'view',
    },
  ];


export class AccountService {
	private contractAddress: string
    private network: string

    constructor(network: string, accountAddress: string) {
        this.network = network
        this.contractAddress = accountAddress
    }

    public isValidSignature(hash: string, signatures: string[]): ChainClient {
      const chainClient = new ChainClient(this.network, {
        contract_address: this.contractAddress,
        entrypoint: "is_valid_signature",
        calldata: [hash, signatures]
      }, TransactionType.READ);
      chainClient.setTransactionToExternalContract(ACCOUNT_ABI, this.contractAddress);
      return chainClient;
    }
}
