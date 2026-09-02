import { DateTime } from "luxon";

import { DbEvents } from "../db/dbEvents";
import { HttpException } from "@/exceptions/HttpException";
import { CreateEventEntry, EventEntry, UpdateEventEntry } from "../db/dbEvents";
import { CreateEventData, EventResponse, UpdateEventData } from "./types/Events";
import { logger } from "@/lib/logger";

const dbEvents = new DbEvents();

function mapEventToResponse(event: EventEntry): EventResponse {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: DateTime
        .fromJSDate(event.startAt)
        .setZone(event.timezone)
        .toFormat("yyyy-MM-dd HH:mm"),
      endAt: DateTime
        .fromJSDate(event.endAt)
        .setZone(event.timezone)
        .toFormat("yyyy-MM-dd HH:mm"),
      timezone: event.timezone,
      isAllDay: event.isAllDay || false,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      urlImage: event.urlImage,
    };
  }

function toUTC(localISO: string, tz: string): Date | null {
    return DateTime
      .fromISO(localISO, { zone: tz })
      .toUTC()
      .toJSDate();
  }

function addDaysToDate(startDate: string, timezone: string, days: number) {
    const startLocal = DateTime.fromISO(startDate, { zone: timezone });
  
    const endLocal = startLocal.plus({ days });
  
    return {
      startAtUTC: startLocal.toUTC().toJSDate(),
      endAtUTC: endLocal.toUTC().toJSDate(),
    };
  }

function eventStartIsInFuture(
    startDate: string,
    timezone: string
  ) {
    const startUTC = DateTime
      .fromISO(startDate, { zone: timezone })
      .toUTC();
  
    const nowUTC = DateTime.utc();
  
    if (startUTC <= nowUTC) {
      return false
    }
    return true;
  }

export async function createEvent(data: CreateEventData): Promise<EventResponse> {
    if (!data.isAllDay && !data.endDate) {
      throw new HttpException(400, 'End date is required for non-all day events', 'END_DATE_REQUIRED');
    }

    const startAtUTC = toUTC(data.startDate, data.timezone);
    if (!startAtUTC) {
      throw new HttpException(400, 'Invalid start date', 'INVALID_START_DATE');
    }
    const endAtUTC   = data.endDate ? 
               toUTC(data.endDate, data.timezone) : 
               addDaysToDate(data.startDate, data.timezone, 1).endAtUTC;
    if (!endAtUTC) {
      throw new HttpException(400, 'Invalid end date', 'INVALID_END_DATE');
    }

    if (!eventStartIsInFuture(data.startDate, data.timezone)) {
      throw new HttpException(400, 'Event date must be today or in the future', 'INVALID_DATE');
    }

    try {
      const createData: CreateEventEntry = {
        title: data.title,
        description: data.description || null,
        location: data.location,
        startAt: startAtUTC,
        endAt: endAtUTC,
        timezone: data.timezone,
        isAllDay: data.isAllDay,
      };

      const event = await dbEvents.createEvent(createData);
      return mapEventToResponse(event);
    } catch (error) {
      logger.error({ error, data }, 'Failed to create event');
      throw new HttpException(500, 'Failed to create event', 'EVENT_CREATION_FAILED', undefined, error);
    }
  }

export async function getFutureEvents(): Promise<EventResponse[]> {
    const events = await dbEvents.findFutureEvents();
    return events.map((event: EventEntry) => mapEventToResponse(event));
}

export async function getEventById(eventId: string): Promise<EventResponse> {
    const event = await dbEvents.findEventById(eventId);
    if (!event) {
        throw new HttpException(404, 'Event not found', 'EVENT_NOT_FOUND');
    }
    const mappedEvent = mapEventToResponse(event);
    return mappedEvent;
}

export async function updateEvent(eventId: string, data: UpdateEventData): Promise<EventResponse> {
    // Check if event exists
    const existingEvent = await dbEvents.findEventById(eventId);
    if (!existingEvent) {
      throw new HttpException(404, 'Event not found', 'EVENT_NOT_FOUND');
    }

    if ((data.startAt !== undefined || data.endAt !== undefined) && !data.timezone) {
      throw new HttpException(400, 'Timezone is required when updating start or end date', 'TIMEZONE_REQUIRED');
    }

    const startLocal = data.startAt
      ? DateTime.fromISO(data.startAt, { zone: data.timezone })
      : DateTime.fromJSDate(existingEvent.startAt).setZone(existingEvent.timezone);

    let endLocal: DateTime;

    if (data.endAt) {
      endLocal = DateTime.fromISO(data.endAt, { zone: data.timezone });
    } else if (data.isAllDay) {
      endLocal = startLocal.plus({ days: 1 });
    } else {
      endLocal = DateTime.fromJSDate(existingEvent.endAt).setZone(existingEvent.timezone);
    }

    if (endLocal <= startLocal) {
      throw new HttpException(400, 'End time must be after start time', 'END_TIME_BEFORE_START_TIME');
    }

    const startAtUTC = startLocal.toUTC().toJSDate();
    const endAtUTC   = endLocal.toUTC().toJSDate();

    try {
      const event = await dbEvents.updateEvent(eventId, {
        title: data.title,
        description: data.description,
        location: data.location,
        startAt: startAtUTC,
        endAt: endAtUTC,
        timezone: data.timezone,
        isAllDay: data.isAllDay,
      });

      return mapEventToResponse(event);
    } catch (error) {
      logger.error({ error, eventId, data }, 'Failed to update event');
      throw new HttpException(500, 'Failed to update event', 'EVENT_UPDATE_FAILED', undefined, error);
    }
  }

export async function deleteEvent(eventId: string): Promise<void> {
    // Check if event exists
    const existingEvent = await dbEvents.findEventById(eventId);
    if (!existingEvent) {
      throw new HttpException(404, 'Event not found', 'EVENT_NOT_FOUND');
    }
    try {
      await dbEvents.deleteEvent(eventId);
      logger.info({
        eventId,
        title: existingEvent.title,
      }, 'Event deleted successfully');
    } catch (error) {
      logger.error({ error, eventId }, 'Failed to delete event');
      throw new HttpException(500, 'Failed to delete event', 'EVENT_DELETE_FAILED', undefined, error);
    }
  }

export async function getTimezones(): Promise<string[]> {
    // only one timezone for now
    return [
      'America/Costa_Rica',
    ]
}
