import { UserEntry } from "@/services/db";
import { TokenPair } from "./Auth";

export interface RegisterUserData {
  walletAddress: string;
  walletProvider?: string;
  /** Base64 signature: SEP-53 for Stellar wallets, the Cavos prefix for Cavos. */
  signature: string;
  /** Cavos only: the control key that signed. If missing, the account itself is assumed. */
  signer?: string;
  nonce: string;
  /** How they signed in, as the web app reports it (display only). */
  loginMethod?: 'email' | 'telegram' | 'wallet';
  /** The email used with Cavos, or the Telegram name. */
  loginIdentity?: string;
  /** Own wallets: which app signed (freighter, lobstr…). */
  walletApp?: string;
}

export type UserResponse = UserEntry;

export interface RegisterUserResponse {
  user: UserResponse;
  tokens: TokenPair;
}
