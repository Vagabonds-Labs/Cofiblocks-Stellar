import { prisma } from '@/lib/prisma';
import { OrderStatus, DeliveryMethod } from '@prisma/client';
import { getPriceWithoutMarketplaceFee } from '@/lib/CofiblocksContracts/utils/utilities';
import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';

export interface OrderEntry {
  id: string;
  buyerId: string;
  status: OrderStatus;
  paymentTx: string | null;
  deliveryId: string | null;
  createdAt: Date;
  expiresAt: Date;
  stripePaymentId: string | null;
}

export interface OrderWithItemsEntry extends OrderEntry {
  orderItems: Array<{
    id: string;
    orderId: string;
    productId: string;
    items: number;
    delivered: boolean;
    producerClaimBalance: number;
    product: {
      id: string;
      ownerId: string;
      tokenId: string | null;
      contractAddress: string;
      network: string;
      title: string;
      description: string | null;
      roastLevel: string;
      grindType: string | null;
      price: number;
      currentStock: number;
      reservedStock: number;
      status: string;
      sales: number;
      imageUrl: string | null;
      farmId: string;
      farm: {
        id: string;
        name: string;
        sales: number;
        region: string;
        country: string;
        altitude: number;
        coordinates: string;
        website: string | null;
        logoUrl: string;
      };
      createdAt: Date;
      updatedAt: Date;
    };
  }>;
  delivery: {
    id: string;
    method: DeliveryMethod;
    paymentTxHash: string | null;
    eventId: string | null;
    price: number | null;
    country: string | null;
    state: string | null;
    city: string | null;
    name: string | null;
    phone: string | null;
    address1: string | null;
    address2: string | null;
    event: {
      id: string;
      title: string;
      location: string | null;
      description: string | null;
      startAt: Date;
      endAt: Date;
      timezone: string;
      isAllDay: boolean | null;
      urlImage: string | null;
    } | null;
  } | null;
}

export interface OrderForCheckoutEntry extends OrderEntry {
  buyer: {
    id: string;
    walletAddress: string;
  } | null;
  orderItems: Array<{
    id: string;
    orderId: string;
    productId: string;
    items: number;
    product: {
      id: string;
      tokenId: string | null;
      title: string;
      currentStock: number;
      status: string;
      price: number;
    };
  }>;
  delivery: {
    id: string;
    method: DeliveryMethod;
    paymentTxHash: string | null;
    eventId: string | null;
    price: number | null;
    country: string | null;
    state: string | null;
    city: string | null;
    address1: string | null;
    address2: string | null;
    name: string | null;
    phone: string | null;
  } | null;
}

export interface OrderForItemsEntry {
  id: string;
  buyerId: string;
  status: OrderStatus;
  expiresAt: Date;
}

export interface CreateOrderEntry {
  buyerId: string;
  status: OrderStatus;
  expiresAt: Date;
}

export interface CreateOrderItemEntry {
  orderId: string;
  productId: string;
  items: number;
}

export interface CreateDeliveryEntry {
  method: DeliveryMethod;
  paymentTxHash?: string | null;
  eventId?: string | null;
  price?: number | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address1?: string | null;
  address2?: string | null;
  name?: string | null;
  phone?: string | null;
}

export interface UpdateDeliveryEntry {
  method?: DeliveryMethod;
  paymentTxHash?: string | null;
  eventId?: string | null;
  price?: number | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address1?: string | null;
  address2?: string | null;
  name?: string | null;
  phone?: string | null;
}

export interface DeliveryEntry {
  id: string;
  orderId: string;
  method: DeliveryMethod;
  paymentTxHash: string | null;
  status: string;
  event: {
    id: string;
    title: string;
    location: string | null;
    description: string | null;
    startAt: string;
    endAt: string;
    timezone: string;
    isAllDay: boolean;
    urlImage: string | null;
  } | null;
  price: number | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address1: string | null;
  address2: string | null;
  name: string | null;
  phone: string | null;
}

export class DbOrders {
  async createOrderWithItems(
    orderData: CreateOrderEntry,
    orderItems: CreateOrderItemEntry[],
    updateProductStock: (productId: string, amount: number, tx: any) => Promise<void>
  ): Promise<OrderEntry> {
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: orderData,
      });

      // Create order items with the correct orderId
      await tx.orderItem.createMany({
        data: orderItems.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          items: item.items,
        })),
      });

      // Update reservedStock for each product
      for (const item of orderItems) {
        await updateProductStock(item.productId, item.items, tx);
      }

      return newOrder;
    });

    return order;
  }

  async findOrdersByBuyerId(
    buyerId: string,
    statuses?: OrderStatus[],
    includeCancelled: boolean = false
  ): Promise<OrderWithItemsEntry[]> {
    const where: any = { buyerId };

    if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    } else if (!includeCancelled) {
      where.status = { notIn: [OrderStatus.CANCELLED] };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        delivery: {
          include: {
            event: true,
          },
        },
        orderItems: {
          include: {
            product: {
              include: {
                farm: true,
              },
            },
          },
        },
      },
    });

    return orders as OrderWithItemsEntry[];
  }

  async findOrderById(
    orderId: string
  ): Promise<OrderWithItemsEntry | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        delivery: {
          include: {
            event: true,
          },
        },
        orderItems: {
          include: {
            product: {
              include: {
                farm: true,
              },
            },
          },
        },
      },
    });

    return order;
  }

  async findOrderByIdForCheckout(orderId: string): Promise<OrderForCheckoutEntry | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                tokenId: true,
                title: true,
                currentStock: true,
                status: true,
                price: true,
              },
            },
          },
        },
        delivery: true,
        buyer: {
          select: {
            id: true,
            walletAddress: true,
          },
        },
      },
    });

    return order as OrderForCheckoutEntry | null;
  }

  async findOrderByIdForItems(orderId: string, status?: OrderStatus): Promise<OrderForItemsEntry | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        status: true,
        expiresAt: true,
      },
    });

    if (status != undefined && status !== null && order?.status !== status) {
      return null;
    }

    return order as OrderForItemsEntry | null;
  }

  async findOrderItemsByOrderId(orderId: string): Promise<OrderWithItemsEntry['orderItems']> {
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      include: {
        product: {
          include: {
            farm: true,
          },
        },
      },
    });

    return orderItems as OrderWithItemsEntry['orderItems'];
  }

  async createDelivery(data: CreateDeliveryEntry, tx?: any): Promise<string> {
    const client = tx || prisma;
    const delivery = await client.delivery.create({
      data: {
        method: data.method,
        paymentTxHash: data.paymentTxHash || null,
        eventId: data.eventId || null,
        price: data.price || null,
        country: data.country || null,
        state: data.state || null,
        city: data.city || null,
        address1: data.address1 || null,
        address2: data.address2 || null,
        name: data.name || null,
        phone: data.phone || null,
      },
    });

    return delivery.id;
  }

  async updateDelivery(deliveryId: string, data: UpdateDeliveryEntry, tx?: any): Promise<void> {
    const client = tx || prisma;
    await client.delivery.update({
      where: { id: deliveryId },
      data: {
        method: data.method,
        paymentTxHash: data.paymentTxHash,
        eventId: data.eventId,
        price: data.price,
        country: data.country,
        state: data.state,
        city: data.city,
        address1: data.address1,
        address2: data.address2,
        name: data.name,
        phone: data.phone,
      },
    });
  }

  async updateOrderDeliveryId(orderId: string, deliveryId: string, tx?: any): Promise<void> {
    const client = tx || prisma;
    await client.order.update({
      where: { id: orderId },
      data: { deliveryId },
    });
  }

  async findEventById(eventId: string, tx?: any): Promise<{ id: string; date: Date | null } | null> {
    const client = tx || prisma;
    const event = await client.cofiblocksEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        date: true,
      },
    });

    return event;
  }

  async registerStripePayment(orderId: string, stripePaymentId: string): Promise<void> {
    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentId: stripePaymentId },
    });
  }

  async markOrderAsPaid(orderId: string, paymentTx: string, tx?: any): Promise<void> {
    const client = tx || prisma;
    await client.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID, paymentTx },
    });

    // update product stock
    const orderItems = await client.orderItem.findMany({
      where: { orderId },
      include: {
        product: true,
      },
    });
    for (const item of orderItems) {
      await client.product.update({
        where: { id: item.productId },
        data: {
          currentStock: {
            decrement: item.items,
          },
          reservedStock: {
            decrement: item.items,
          },
          sales: {
            increment: item.items,
          },
        },
      });

      await client.farm.update({
        where: { id: item.product.farmId },
        data: {
          sales: {
            increment: item.items,
          },
        },
      });
    }
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, tx?: any): Promise<void> {
    const client = tx || prisma;
    await client.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  async registerDeliveryPayment(deliveryId: string, paymentTx: string, tx?: any): Promise<void> {
    const client = tx || prisma;
    await client.delivery.update({
      where: { id: deliveryId },
      data: { paymentTxHash: paymentTx },
    });
  }

  async findOrderDeliveryById(deliveryId: string, tx?: any): Promise<DeliveryEntry | null> {
    const client = tx || prisma;
    const delivery = await client.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        event: true,
      },
    });
    return delivery;
  }

  async isTxHashAlreadyUsed(txHash: string, tx?: any): Promise<boolean> {
    const client = tx || prisma;
    const order = await client.order.findFirst({
      where: { paymentTx: txHash },
    });
    return !!order;
  }

  async markProducerClaimBalance(orderId: string, tx?: any): Promise<string[]> {
    const client = tx || prisma;
    const productOwners = []
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });
    for (const item of order.orderItems) {
      const productPrice = getPriceWithoutMarketplaceFee(item.product.price);
      productOwners.push(item.product.ownerId);
      await client.orderItem.update({
        where: { id: item.id },
        data: { producerClaimBalance: { set: item.items * productPrice } },
      });
    }
    return productOwners;
  }

  async cleanProducerClaimBalance(
    sellerId: string,
    txHash: string,
    tx?: any
  ): Promise<void> {
    const client = tx ?? prisma;
  
    await client.orderItem.updateMany({
      where: {
        producerClaimBalance: { gt: 0 },
        product: {
          is: {
            ownerId: sellerId,
          },
        },
      },
      data: {
        producerClaimBalance: 0,
        sellerClaimTx: txHash,
      },
    });
  }

  async findSalesByProductOwnerId(productOwnerId: string): Promise<OrderWithItemsEntry[]> {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.DELIVERED, OrderStatus.IN_DELIVERY, OrderStatus.PAID],
        },
        orderItems: {
          some: {
            product: {
              ownerId: productOwnerId,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        delivery: {
          include: {
            event: true,
          },
        },
        orderItems: {
          where: {
            product: {
              ownerId: productOwnerId,
            },
          },
          include: {
            product: {
              include: {
                farm: true,
              },
            },
          },
        },
      },
    });

    return orders as OrderWithItemsEntry[];
  }

  async findSaleByOrderIdAndProductOwnerId(
    orderId: string,
    productOwnerId: string,
    statuses: OrderStatus[]
  ): Promise<OrderWithItemsEntry | null> {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: {
          in: statuses,
        },
        orderItems: {
          some: {
            product: {
              ownerId: productOwnerId,
            },
          },
        },
      },
      include: {
        delivery: {
          include: {
            event: true,
          },
        },
        orderItems: {
          where: {
            product: {
              ownerId: productOwnerId,
            },
          },
          include: {
            product: {
              include: {
                farm: true,
              },
            },
          },
        },
      },
    });

    return order as OrderWithItemsEntry | null;
  }

  async markOrderItemsAsDeliveredByProductOwner(
    orderId: string,
    productOwnerId: string
  ): Promise<number> {
    // Mark all orderItems as delivered where product.ownerId == productOwnerId
    const result = await prisma.orderItem.updateMany({
      where: {
        orderId: orderId,
        product: {
          ownerId: productOwnerId,
        },
        delivered: false,
      },
      data: {
        delivered: true,
      },
    });

    return result.count;
  }

  async areAllOrderItemsDelivered(orderId: string): Promise<boolean> {
    // Check if all orderItems in the order have delivered=true
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          select: {
            delivered: true,
          },
        },
      },
    });

    if (!order || order.orderItems.length === 0) {
      return false;
    }

    return order.orderItems.every((item) => item.delivered === true);
  }

  async updateOrderDelivery(
    orderId: string, orderDeliveryId: string | null, deliveryEntry: CreateDeliveryEntry
  ): Promise<string> {
    const deliveryId = await prisma.$transaction(async (tx) => {
        let delivery;
        // If order already has a delivery, update it instead of creating a new one
        if (orderDeliveryId) {
            await this.updateDelivery(orderDeliveryId, deliveryEntry, tx);
            delivery = { id: orderDeliveryId };
        } else {
            const newDeliveryId = await this.createDelivery(deliveryEntry, tx);
            delivery = { id: newDeliveryId };
        }
        await this.updateOrderDeliveryId(orderId, delivery.id, tx);
        return delivery.id;
    });
    return deliveryId;
  }

  async findOrdersWithFilters(filters: {
    status?: OrderStatus[];
    buyerId?: string;
    productId?: string;
    deliveryMethod?: DeliveryMethod;
    eventId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<OrderWithItemsEntry[]> {
    const where: any = {};

    // Filter by status
    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    } else {
      where.status = { notIn: [OrderStatus.CANCELLED] };
    }

    // Filter by buyerId
    if (filters.buyerId) {
      where.buyerId = filters.buyerId;
    }

    // Filter by productId (through orderItems)
    if (filters.productId) {
      where.orderItems = {
        some: {
          productId: filters.productId,
        },
      };
    }

    // Filter by delivery method and/or eventId (through delivery)
    if (filters.deliveryMethod || filters.eventId) {
      where.delivery = {};
      if (filters.deliveryMethod) {
        where.delivery.method = filters.deliveryMethod;
      }
      if (filters.eventId) {
        where.delivery.eventId = filters.eventId;
      }
    }

    // Filter by date range
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        delivery: {
          include: {
            event: true,
          },
        },
        orderItems: {
          include: {
            product: {
              include: {
                farm: true,
              },
            },
          },
        },
      },
    });

    return orders as OrderWithItemsEntry[];
  }
  
  async findOrderSellers(orderId: string): Promise<string[]> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!order) {
      throw new HttpException(404, 'Order not found', 'ORDER_NOT_FOUND');
    }
    return order.orderItems.map((item) => item.product.ownerId);
  }

  async deletePendingPaymentOrder(orderId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // we should remove reserved stock from products
      const orderItems = await tx.orderItem.findMany({
        where: { orderId: orderId },
        include: {
          product: true,
        },
      });
      logger.info('found ' + orderItems.length + ' order items to delete');
      for (const item of orderItems) {
        logger.info('deleting reserved stock for product ' + item.productId);
        await tx.product.update({
          where: { id: item.productId },
          data: {
            reservedStock: {
              decrement: item.items,
            },
          },
        });
      }

      // remove delivery if any
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          deliveryId: true,
        },
      });
      if (order?.deliveryId) {
        logger.info('deleting delivery ' + order.deliveryId);
        await tx.delivery.delete({
          where: { id: order.deliveryId },
        });
      }

      // remove order
      logger.info('deleting order ' + orderId);
      await tx.order.delete({
        where: { id: orderId },
      });
    });
  }


  async getProductOrders(productId: string, orderStatuses: OrderStatus[]): Promise<OrderWithItemsEntry[]> {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: orderStatuses,
        },
        orderItems: {
          some: {
            productId: productId,
          },
        },
      },
    });

    return orders as OrderWithItemsEntry[];
  }

  async findLatestPendingPaymentOrderByBuyerId(userId: string): Promise<OrderWithItemsEntry | null> {
    const order = await prisma.order.findFirst({
      where: { buyerId: userId, status: OrderStatus.PENDING_PAYMENT, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: {
        delivery: true,
        orderItems: {
          include: {
            product: {
              include: {
                farm: true,
              },
            },
          },
        },
      },
    });
    return order as OrderWithItemsEntry | null;
  }
}

