export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
  urlImage: string | null;
}

export interface EventsResponse {
  data: Event[];
}

export interface CreateEventData {
  title: string;
  description?: string;
  location: string;
  startDate: string; // ISO 8601 datetime string (without timezone offset)
  endDate?: string; // ISO 8601 datetime string (without timezone offset)
  timezone: string; // IANA timezone format
  isAllDay: boolean;
}

export interface CreateEventResponse {
  data: Event;
  message: string;
}

export interface UpdateEventData {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  startAt?: string; // ISO 8601 datetime string (without timezone offset)
  endAt?: string; // ISO 8601 datetime string (without timezone offset)
  timezone?: string; // IANA timezone format
  isAllDay?: boolean;
}

export interface UpdateEventResponse {
  data: Event;
  message: string;
}

