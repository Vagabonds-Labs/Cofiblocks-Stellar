export interface Farm {
    id: string;
    name: string;
    sales: number;
    region: string;
    country: string;
    altitude: number;
    coordinates: string;
    website: string | null;
    logoUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface CreateFarmData {
    name: string;
    sales: number;
    region: string;
    country: string;
    altitude: number;
    coordinates: string;
    website?: string;
    logoUrl?: string;
  }
  
  export interface FarmsResponse {
    data: Farm[];
  }
  
  export interface FarmResponse {
    farm: Farm;
  }
  
  export interface CreateFarmResponse {
    message: string;
    farm: Farm;
  }