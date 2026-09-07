import { SellerType } from "@prisma/client";
import { TokenPair } from "./Auth";

export interface RegisterUserData {
    walletAddress: string;
    walletProvider?: string;
    /** Firma SEP-53 en base64. Antes era el par (r, s) de Starknet. */
    signature: string;
    nonce: string;
  }

  export interface UserResponse {
    id: string;
    name: string | null;
    email: string | null;
    walletAddress: string | null;
    sellerType: SellerType | null;
    isAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

export interface RegisterUserResponse {
    user: UserResponse;
    tokens: TokenPair;
  }