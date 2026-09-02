import { SellerType } from "@prisma/client";
import { TokenPair } from "./Auth";

export interface RegisterUserData {
    walletAddress: string;
    walletProvider?: string;
    signature: string[];
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