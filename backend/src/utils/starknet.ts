import { typedData, RpcProvider } from 'starknet';
import { HttpException } from '@/exceptions/HttpException';
import { verifySignature } from '@/services/onchain/OnChainSignatureService';
import { logger } from '@/lib/logger';
/**
 * Verify a Starknet wallet signature (typed data format)
 * @param address - The wallet address that signed the message
 * @param message - The message that was signed (typically a nonce)
 * @param signature - The signature array (r, s format)
 * @returns true if signature is valid, throws HttpException if invalid
 */
export async function verifyStarknetSignature(
  address: string,
  message: string,
  signature: string[],
): Promise<boolean> {
  try {
    // Normalize address format
    const normalizedAddress = address.toLowerCase();
    
    // Create typed data for message signing
    // This matches the standard Starknet message signing format
    const messageTypedData = {
      domain: {
        name: 'CofiBlocks',
        version: '1',
        chainId: process.env.STARKNET_NETWORK === 'mainnet' ? 'SN_MAIN' : 'SN_SEPOLIA', // Adjust based on your network
      },
      types: {
        StarkNetDomain: [
          { name: 'name', type: 'felt' },
          { name: 'version', type: 'felt' },
          { name: 'chainId', type: 'felt' },
        ],
        Message: [
          { name: 'nonce', type: 'felt' },
        ],
      },
      primaryType: 'Message',
      message: {
        nonce: message,
      },
    };

    // Get message hash
    const messageHash = typedData.getMessageHash(messageTypedData, normalizedAddress);
    
    // Basic validation: check that signature is an array with at least 2 elements
    if (!Array.isArray(signature) || signature.length < 2) {
      throw new HttpException(401, 'Invalid signature format', 'INVALID_SIGNATURE_FORMAT');
    }

    const isValid = await verifySignature(messageHash, signature, address)
    if (!isValid) {
      throw new HttpException(401, 'Invalid signature', 'INVALID_SIGNATURE');
    }

    return true;
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    // Log the error for debugging
    logger.error('Signature verification error: ' + error);
    throw new HttpException(401, 'Signature verification failed', 'SIGNATURE_VERIFICATION_FAILED');
  }
}

