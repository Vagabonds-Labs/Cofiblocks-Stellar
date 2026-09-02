import { OrderResponse, OrdersFilter } from "./types/Orders";
import { DbOrders } from "../db";
import * as ordersMappers from '@/services/mappers/ordersMappers';

const dbOrders = new DbOrders();

export async function getOrders(orderFilter: OrdersFilter): Promise<OrderResponse[]> {
  const orders = await dbOrders.findOrdersWithFilters({
    status: orderFilter.status,
    buyerId: orderFilter.buyerId,
    productId: orderFilter.productId,
    deliveryMethod: orderFilter.deliveryMethod,
    eventId: orderFilter.eventId,
    startDate: orderFilter.startDate,
    endDate: orderFilter.endDate,
  });

  return orders.map(order => ordersMappers.mapOrderToResponse(order));
}