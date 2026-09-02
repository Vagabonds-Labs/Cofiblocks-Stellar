export interface CreateEventData {
    title: string;
    description?: string;
    location: string;
    startDate: string;
    endDate?: string;
    timezone: string;
    isAllDay: boolean;
  }
  
  export interface UpdateEventData {
    title?: string;
    description?: string;
    location?: string;
    startAt?: string;
    endAt?: string;
    timezone?: string;
    isAllDay?: boolean;
  }
  
  export interface EventResponse {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startAt: string;
    endAt: string;
    timezone: string;
    isAllDay: boolean;
    createdAt: Date;
    updatedAt: Date;
    urlImage: string | null;
  }
  
  