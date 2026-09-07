import { createHash } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';

import { HttpException } from '@/exceptions/HttpException';
import { isClassicAddress, isContractAddress } from '@/lib/StellarContracts/utils';
import { logger } from '@/lib/logger';

/**
 * Prefijo de SEP-53. Es lo que las wallets anteponen antes de hashear, para que
 * un mensaje firmado nunca pueda pasar por una transacción firmada.
 */
const SEP53_PREFIX = 'Stellar Signed Message:\n';

/** `SHA256("Stellar Signed Message:\n" + mensaje)`, que es lo que se firma. */
export function hashSignedMessage(message: string): Buffer {
  return createHash('sha256')
    .update(Buffer.concat([Buffer.from(SEP53_PREFIX, 'utf8'), Buffer.from(message, 'utf8')]))
    .digest();
}

/**
 * Verifica una firma de wallet en local, sin tocar la red.
 *
 * En Starknet había que llamar a `is_valid_signature` del contrato de cuenta del
 * usuario, con reintentos porque el RPC fallaba. Las cuentas clásicas de Stellar
 * son claves ed25519: se verifican con la clave pública y nada más.
 *
 * Las cuentas contrato (`C…`, smart wallets y passkeys) no se verifican así.
 * v1 las rechaza con un error explícito en vez de fallar de forma confusa.
 */
export function verifyStellarSignature(
  address: string,
  message: string,
  signature: string
): boolean {
  if (isContractAddress(address)) {
    throw new HttpException(
      400,
      'Smart wallet accounts (C…) are not supported yet. Connect a classic Stellar account.',
      'UNSUPPORTED_ACCOUNT_TYPE'
    );
  }
  if (!isClassicAddress(address)) {
    throw new HttpException(401, 'Invalid Stellar address', 'INVALID_ADDRESS');
  }

  let isValid = false;
  try {
    isValid = Keypair.fromPublicKey(address).verify(
      hashSignedMessage(message),
      Buffer.from(signature, 'base64')
    );
  } catch (error) {
    logger.warn({ error, address }, 'Could not verify Stellar signature');
    throw new HttpException(401, 'Invalid signature', 'INVALID_SIGNATURE');
  }

  if (!isValid) {
    throw new HttpException(401, 'Invalid signature', 'INVALID_SIGNATURE');
  }
  return true;
}
