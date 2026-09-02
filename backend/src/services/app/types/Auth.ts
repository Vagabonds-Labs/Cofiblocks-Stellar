export interface TokenPair {
    accessToken: string;
    refreshToken: string;
  }

export interface TokenPayload {
    userId: string;
    walletAddress: string;
    is_admin: boolean;
    is_producer: boolean;
    is_roaster: boolean;
}