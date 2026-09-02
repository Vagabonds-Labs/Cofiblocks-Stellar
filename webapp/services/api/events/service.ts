/**
 * Events Service
 * Handles event-related API calls
 */

import { api } from '@/lib/api';
import { 
  EventsResponse, 
  CreateEventData, 
  CreateEventResponse,
  UpdateEventData,
  UpdateEventResponse,
  Event
} from './types';

export class EventsService {
  /**
   * Get all future events
   */
  async getFutureEvents(): Promise<Event[]> {
    const response = await api.get<{ success: boolean; data: Event[]; message: string }>('/events');
    return response.data;
  }

  /**
   * Create a new event (Admin only)
   * @param data - Event data
   */
  async createEvent(data: CreateEventData): Promise<Event> {
    const response = await api.post<CreateEventResponse>('/events/create_event', data);
    return response.data;
  }

  /**
   * Get a single event by ID (Admin only)
   * @param eventId - Event ID
   */
  async getEventById(eventId: string): Promise<Event> {
    const response = await api.get<{data: Event}>(`/events/${eventId}`);
    return response.data;
  }

  /**
   * Update an existing event (Admin only)
   * @param data - Event data with id
   */
  async updateEvent(data: UpdateEventData): Promise<Event> {
    const response = await api.patch<UpdateEventResponse>('/events/event', data);
    return response.data;
  }

  /**
   * Delete an existing event (Admin only)
   * @param eventId - Event ID
   */
  async deleteEvent(eventId: string): Promise<void> {
    await api.delete(`/events/${eventId}`);
  }

  async getTimezones(): Promise<string[]> {
    const response = await api.get<{data: string[]}>('/events/timezones');
    return response.data;
  }
}

// Export singleton instance
export const eventsService = new EventsService();

