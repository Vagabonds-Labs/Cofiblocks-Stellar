import { DeliveryMethod } from "@prisma/client";
import { DeliveryHomeInput } from "./types/Orders";
import { DbEvents, CreateDeliveryEntry } from "../db";
import { HttpException } from "@/exceptions/HttpException";

const dbEvents = new DbEvents();

export function isGamDelivery(state: string): boolean {
  const gamStates = ['alajuela', 'heredia', 'san jose', 'cartago'];
  const normalizedState = state.toLowerCase();
  return gamStates.includes(normalizedState);
}

/**
 * Calculate home delivery price based on state
 * @param state - The state/province name (case-insensitive)
 * @returns The delivery price (4 for GAM states, 6 for others)
 */
export function calculateHomeDeliveryPrice(state: string): number {
    const isGam = isGamDelivery(state);
    if (isGam) {
      return 4;
    }
    return 6;
}


export async function buildDeliveryEntry(
    delivery_event_id: string | null,
    delivery_home: DeliveryHomeInput | null
): Promise<CreateDeliveryEntry> {
    const deliveryEntry = {
      method: delivery_event_id ? DeliveryMethod.EVENT : DeliveryMethod.HOME,
      paymentTxHash: null as string | null,
    };
  
    if (delivery_event_id) {
      const event = await dbEvents.findEventById(delivery_event_id);
      if (!event) {
        throw new HttpException(404, 'Event not found', 'EVENT_NOT_FOUND');
      }

      const now = new Date();
      const eventEnd = new Date(event.endAt);

      // Validate event date
      if (now > eventEnd) {
        throw new HttpException(
          400,
          'Event date must be today or in the future',
          'INVALID_EVENT_DATE'
        );
      }

      return {
        ...deliveryEntry,
        eventId: delivery_event_id,
        price: 0,
      };
    }
  
    // HOME DELIVERY
    if (!delivery_home) {
      throw new HttpException(
        400,
        'Home delivery information is required',
        'HOME_DELIVERY_INFORMATION_REQUIRED'
      );
    }
  
    const home = delivery_home;
    if (!home.country || !home.city || !home.state || !home.address1 || !home.name) {
      throw new HttpException(
        400,
        'Country, state, city, address1, and name are required for home delivery',
        'HOME_DELIVERY_INFORMATION_REQUIRED'
      );
    }

    const deliveryPrice = calculateHomeDeliveryPrice(home.state);
    return {
      ...deliveryEntry,
      price: deliveryPrice,
      country: home.country,
      state: home.state,
      city: home.city,
      address1: home.address1,
      address2: home.address2 || null,
      name: home.name,
      phone: home.phone || null,
    };
  }