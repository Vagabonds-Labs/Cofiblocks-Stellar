"use client";

import { FeeBumpTransaction, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

/**
 * Firma con la wallet embebida de Privy (login por email o Google).
 *
 * Para Stellar, Privy sólo firma hashes crudos (`signRawHash`): no arma, no
 * envía y no paga fees. No hace falta más, porque todo eso ya lo hace nuestro
 * backend. El contrato con él es el mismo que con Freighter o LOBSTR: recibe el
 * XDR sin firmar y devuelve el sobre firmado.
 *
 * Los hooks de Privy sólo existen dentro de React. `PrivyBridge` registra acá
 * la sesión activa para que `walletService`, que no es un componente, pueda
 * firmar sin saber de hooks.
 */

const SEP53_PREFIX = "Stellar Signed Message:\n";

export type SignRawHash = (input: {
  address: string;
  chainType: "stellar";
  hash: `0x${string}`;
}) => Promise<{ signature: `0x${string}` }>;

interface PrivySession {
  address: string;
  signRawHash: SignRawHash;
  logout: () => Promise<void>;
}

export function isPrivyEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function hexToBase64(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  let binary = "";
  for (let i = 0; i < clean.length; i += 2) {
    binary += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return btoa(binary);
}

/**
 * Firma el hash de la transacción y le agrega la firma al sobre.
 *
 * `addSignature` verifica la firma contra la clave pública antes de agregarla,
 * así que una firma de otra cuenta falla acá y no en el backend.
 */
export async function signTransactionWithPrivy(
  signRawHash: SignRawHash,
  xdr: string,
  networkPassphrase: string,
  address: string
): Promise<string> {
  const tx: Transaction | FeeBumpTransaction = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  const { signature } = await signRawHash({
    address,
    chainType: "stellar",
    hash: bytesToHex(tx.hash()),
  });
  tx.addSignature(address, hexToBase64(signature));
  return tx.toXDR();
}

/**
 * Firma un mensaje con formato SEP-53: `SHA256(prefijo + mensaje)`.
 *
 * Es el mismo hash que arman Freighter y LOBSTR, así que el backend lo verifica
 * con el mismo `verifyStellarSignature`. Devuelve la firma en base64.
 */
export async function signMessageWithPrivy(
  signRawHash: SignRawHash,
  message: string,
  address: string
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(SEP53_PREFIX + message)
  );
  const { signature } = await signRawHash({
    address,
    chainType: "stellar",
    hash: bytesToHex(new Uint8Array(digest)),
  });
  return hexToBase64(signature);
}

const SESSION_WAIT_MS = 10_000;

class PrivySigner {
  private session: PrivySession | null = null;
  private waiters: Array<() => void> = [];

  register(session: PrivySession): void {
    this.session = session;
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((resolve) => resolve());
  }

  clear(): void {
    this.session = null;
  }

  hasAddress(address: string): boolean {
    return this.session?.address === address;
  }

  /**
   * Espera a que Privy termine de cargar.
   *
   * Al recargar la página, la sesión de nuestro backend ya existe pero el SDK de
   * Privy tarda un momento en restaurar la suya. Si no aparece, es que la
   * sesión de Privy venció aunque la nuestra siga viva.
   */
  private async requireSession(address: string): Promise<PrivySession> {
    if (!this.session) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, SESSION_WAIT_MS);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (!this.session) {
      throw new Error("Your email session expired. Log out and sign in again.");
    }
    if (this.session.address !== address) {
      throw new Error("Wallet mismatch, please sign in with the correct account");
    }
    return this.session;
  }

  async signTransaction(xdr: string, networkPassphrase: string, address: string): Promise<string> {
    const session = await this.requireSession(address);
    return signTransactionWithPrivy(session.signRawHash, xdr, networkPassphrase, address);
  }

  async logout(): Promise<void> {
    const session = this.session;
    this.session = null;
    await session?.logout();
  }
}

export const privySigner = new PrivySigner();
