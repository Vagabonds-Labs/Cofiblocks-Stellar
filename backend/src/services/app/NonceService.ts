import { randomBytes } from 'crypto';

import { HttpException } from '@/exceptions/HttpException';
import { DbAuthNonce } from '@/services/db';
import { isClassicAddress } from '@/lib/StellarContracts/utils';

const dbAuthNonce = new DbAuthNonce();

/** Ventana corta: el usuario firma en el momento o pide otro. */
const NONCE_TTL_SECONDS = 5 * 60;

export interface IssuedNonce {
  nonce: string;
  /** El mensaje literal que la wallet tiene que firmar, formato SEP-53. */
  message: string;
  expires_at: number;
}

/**
 * Emite un nonce de un solo uso para el login por firma.
 *
 * Antes lo generaba el cliente (`Date.now()-random` en `webapp/utils/signature.ts`)
 * y el backend nunca lo emitía ni lo invalidaba, así que una misma firma servía
 * para siempre. Ahora sale de acá, vence en 5 minutos y se consume una vez.
 */
export async function issueNonce(walletAddress?: string): Promise<IssuedNonce> {
  if (walletAddress && !isClassicAddress(walletAddress)) {
    throw new HttpException(
      400,
      'Only classic Stellar accounts (G…) are supported',
      'UNSUPPORTED_ACCOUNT_TYPE'
    );
  }

  const nonce = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000);
  await dbAuthNonce.createNonce(nonce, expiresAt, walletAddress);

  return {
    nonce,
    message: buildLoginMessage(nonce),
    expires_at: Math.floor(expiresAt.getTime() / 1000),
  };
}

/** El mensaje que se firma. Legible para que el usuario vea qué está firmando. */
export function buildLoginMessage(nonce: string): string {
  return `CofiBlocks login\nnonce: ${nonce}`;
}

/**
 * Consume el nonce. Falla si no lo emitió el backend, si ya se usó o si venció.
 */
export async function consumeNonce(nonce: string, walletAddress: string): Promise<void> {
  const entry = await dbAuthNonce.consumeNonce(nonce);
  if (!entry) {
    throw new HttpException(401, 'Invalid, expired or already used nonce', 'INVALID_NONCE');
  }
  if (entry.walletAddress && entry.walletAddress !== walletAddress) {
    throw new HttpException(401, 'Nonce was issued for a different wallet', 'NONCE_WALLET_MISMATCH');
  }
}
