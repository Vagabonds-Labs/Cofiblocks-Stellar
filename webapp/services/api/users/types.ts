export interface User {
    id: string;
    name: string | null;
    email: string | null;
    walletAddress: string | null;
    walletProvider: string | null;
    sellerType: 'PRODUCER' | 'ROASTER' | null;
    isAdmin: boolean;
    createdAt: string;
    updatedAt: string;
  }
  
  export interface GetAllUsersResponse {
    users: User[];
    total: number;
    limit: number;
    offset: number;
  }
  
  export interface GetAllUsersFilters {
    sellerType?: 'PRODUCER' | 'ROASTER';
    isAdmin?: boolean;
    email?: string;
    name?: string;
    walletAddress?: string;
    walletProvider?: string;
    limit?: number;
    offset?: number;
  }