import { prisma } from '@/lib/prisma';
import { DateTime } from 'luxon';

export interface CreateEventEntry {
  title: string;
  description?: string | null;
  location: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  isAllDay: boolean;
}

export interface UpdateEventEntry {
  title?: string;
  description?: string | null;
  location?: string;
  startAt?: Date;
  endAt?: Date;
  timezone?: string;
  isAllDay?: boolean;
}

export interface EventEntry {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  timezone: string;
  isAllDay: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  urlImage: string | null;
}

export class DbEvents {
  async createEvent(data: CreateEventEntry): Promise<EventEntry> {
    const event = await prisma.cofiblocksEvent.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        location: data.location.trim(),
        startAt: data.startAt,
        endAt: data.endAt,
        timezone: data.timezone,
        isAllDay: data.isAllDay,
      },
    });

    return event;
  }

  async findFutureEvents(): Promise<EventEntry[]> {
    const nowUTC = DateTime.utc().toJSDate();
    const events = await prisma.cofiblocksEvent.findMany({
      where: {
        endAt: {
          gte: nowUTC,
        },
      },
      orderBy: {
        startAt: 'asc',
      },
    });

    return events;
  }

  async findEventById(eventId: string, tx?: any): Promise<EventEntry | null> {
    const client = tx || prisma;
    const event = await client.cofiblocksEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return null;
    }

    return event;
  }

  async updateEvent(eventId: string, data: UpdateEventEntry): Promise<EventEntry> {
    const updateData: any = {};
    
    if (data.title !== undefined) {
      updateData.title = data.title.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.location !== undefined) {
      updateData.location = data.location.trim();
    }
    if (data.startAt !== undefined) {
      updateData.startAt = data.startAt;
    }
    if (data.endAt !== undefined) {
      updateData.endAt = data.endAt;
    }
    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone;
    }
    if (data.isAllDay !== undefined) {
      updateData.isAllDay = data.isAllDay;
    }

    const event = await prisma.cofiblocksEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    return event;
  }

  async deleteEvent(eventId: string): Promise<void> {
    await prisma.cofiblocksEvent.delete({
      where: { id: eventId },
    });
  }
}

