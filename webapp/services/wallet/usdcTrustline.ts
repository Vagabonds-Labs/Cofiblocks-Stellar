"use client";

import { onchainService } from "@/services/api/onchain";
import { walletService } from "@/services/wallet/walletService";

/**
 * Deja la cuenta lista para recibir USDC, si todavía no lo está.
 *
 * Crea la cuenta y la trustline patrocinadas por el backend (el usuario no pone
 * XLM). Se llama justo antes de lo que necesita USDC —recibir dinero, pedir
 * USDC de prueba, cobrar ventas— y no al registrarse: cada cuenta patrocinada
 * inmoviliza 1,5 XLM nuestros, y no tiene sentido pagarlos por quien sólo mira.
 *
 * Con Privy la firma es invisible; con una wallet de extensión el usuario ve
 * el pedido de firma, como en cualquier otra operación.
 *
 * @returns `true` si la creó, `false` si ya existía.
 */
export async function ensureUSDCTrustline(address: string): Promise<boolean> {
  const { required, tx } = await onchainService.getUSDCTrustline();
  if (!required || !tx) return false;

  // El backend ya firmó como patrocinador; falta la firma del usuario.
  const signedXdr = await walletService.signTransactionAs(tx, address);
  await onchainService.submitUSDCTrustline(signedXdr);
  return true;
}
