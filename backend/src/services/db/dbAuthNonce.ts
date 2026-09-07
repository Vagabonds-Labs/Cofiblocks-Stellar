import { prisma } from '@/lib/prisma';

export interface AuthNonceEntry {
  id: string;
  nonce: string;
  walletAddress: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
}

export class DbAuthNonce {
  async createNonce(nonce: string, expiresAt: Date, walletAddress?: string): Promise<AuthNonceEntry> {
    return prisma.authNonce.create({
      data: { nonce, expiresAt, walletAddress: walletAddress ?? null },
    });
  }

  /**
   * Marca el nonce como consumido y devuelve si era válido.
   *
   * El `updateMany` con `consumedAt: null` en el where hace que dos peticiones
   * simultáneas no puedan consumir el mismo nonce: la segunda actualiza 0 filas.
   */
  async consumeNonce(nonce: string): Promise<AuthNonceEntry | null> {
    const entry = await prisma.authNonce.findUnique({ where: { nonce } });
    if (!entry || entry.consumedAt || entry.expiresAt < new Date()) {
      return null;
    }
    const consumed = await prisma.authNonce.updateMany({
      where: { nonce, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return consumed.count === 1 ? entry : null;
  }

  /** Limpieza de los que ya vencieron. */
  async deleteExpired(): Promise<number> {
    const result = await prisma.authNonce.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
