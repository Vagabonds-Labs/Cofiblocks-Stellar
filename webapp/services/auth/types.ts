export interface User {
    id: string;
    name: string;
    email: string;
    roles: string[];
    createdAt: string;
    updatedAt: string;
    walletAddress?: string | null;
    walletProvider?: string | null;
    sellerType?: 'PRODUCER' | 'ROASTER' | null;
    isAdmin?: boolean;
  }