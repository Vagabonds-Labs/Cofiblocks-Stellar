
import { DeliveryEntry, OrderWithItemsEntry, EventEntry } from '@/services/db';
import { DeliveryResponse, OrderResponse, CofiblocksEventResponse, OrderItemResponse } from '../app/types/Orders';
import { DateTime } from 'luxon';


function mapFarmToResponse(farm: OrderWithItemsEntry['orderItems'][0]['product']['farm']): OrderItemResponse['product']['farm'] {
    return {
        id: farm.id,
        name: farm.name,
        sales: farm.sales,
        region: farm.region,
        country: farm.country,
        altitude: farm.altitude,
        coordinates: farm.coordinates,
        website: farm.website,
        logoUrl: farm.logoUrl,
    };
}

export function mapProductToResponse(product: OrderWithItemsEntry['orderItems'][0]['product']): OrderItemResponse['product'] {
    return {
        id: product.id,
        tokenId: product.tokenId,
        contractAddress: product.contractAddress,
        network: product.network,
        title: product.title,
        description: product.description,
        roastLevel: product.roastLevel,
        grindType: product.grindType,
        price: product.price,
        currentStock: product.currentStock,
        reservedStock: product.reservedStock,
        status: product.status,
        sales: product.sales,
        imageUrl: product.imageUrl,
        farmId: product.farmId,
        farm: mapFarmToResponse(product.farm),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    };
}

export function mapOrderItemToResponse(item: OrderWithItemsEntry['orderItems'][0]): OrderItemResponse {
    return {
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        items: item.items,
        delivered: item.delivered,
        producerClaimBalance: item.producerClaimBalance,
        product: mapProductToResponse(item.product),
    };
}

function mapEventToResponse(event: NonNullable<OrderWithItemsEntry['delivery']>['event']): CofiblocksEventResponse {
    return {
        id: event?.id ?? null,
        title: event?.title ?? null,
        location: event?.location ?? null,
        description: event?.description ?? null,
        startAt: DateTime
            .fromJSDate(event?.startAt ?? new Date())   // UTC instant
            .setZone(event?.timezone)     // reinterpret for display
            .toFormat("yyyy-MM-dd HH:mm"),
        endAt: DateTime
            .fromJSDate(event?.endAt ?? new Date())   // UTC instant
            .setZone(event?.timezone)     // reinterpret for display
            .toFormat("yyyy-MM-dd HH:mm"),
        timezone: event?.timezone ?? null,
        isAllDay: event?.isAllDay ?? null,
        urlImage: event?.urlImage ?? null,
    };
  }

function mapDeliveryToResponse(delivery: OrderWithItemsEntry['delivery']): DeliveryResponse | null {
    if (!delivery) {
        return null;
    }
    return {
        id: delivery.id ?? null,
        method: delivery.method ?? null,
        paymentTxHash: delivery.paymentTxHash,
        event: delivery.event ? mapEventToResponse(delivery.event) : null,
        price: delivery.price,
        country: delivery.country,
        state: delivery.state,
        city: delivery.city,
        address1: delivery.address1,
        address2: delivery.address2,
        name: delivery.name,
        phone: delivery.phone,
    };
  }

export function mapOrderToResponse(order: OrderWithItemsEntry): OrderResponse {
    return {
      id: order.id,
      buyerId: order.buyerId,
      status: order.status,
      paymentTx: order.paymentTx,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      delivery: order.delivery ? mapDeliveryToResponse(order.delivery) : null,
      orderItems: order.orderItems.map(item => mapOrderItemToResponse(item)),
    };
  }