import { PreparedTransaction } from "@/lib/StellarContracts/types/transactions";
import { DeliveryMethod, OrderStatus } from "@prisma/client";

export interface CreateOrderItem {
    id: string; // product_id
    amount: number; // amount of items to add
}

export interface CreateOrderData {
    products: CreateOrderItem[];
}

export interface CofiblocksEventResponse {
    id: string | null;
    title: string | null;
    location: string | null;
    description: string | null;
    startAt: string | null;
    endAt: string | null;
    timezone: string | null;
    isAllDay: boolean | null;
    urlImage: string | null
}

export interface DeliveryResponse {
    id: string | null;
    method: DeliveryMethod | null;
    paymentTxHash: string | null;
    event: CofiblocksEventResponse | null;
    price: number | null;
    country: string | null;
    state: string | null;
    city: string | null;
    address1: string | null;
    address2: string | null;
    name: string | null;
    phone: string | null;
}

export interface OrderResponse {
    id: string;
    buyerId: string;
    status: OrderStatus;
    paymentTx: string | null;
    createdAt: Date;
    expiresAt: Date;
    delivery: DeliveryResponse | null;
    orderItems: OrderItemResponse[];
}

export interface OrderItemResponse {
    id: string;
    orderId: string;
    productId: string;
    items: number;
    delivered: boolean;
    producerClaimBalance: number;
    product: {
        id: string;
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
}

export interface CheckoutOrderInput {
    id: string;
    delivery_event_id: string | null;
    delivery_home: DeliveryHomeInput | null;
}

export interface DeliveryHomeInput {
    country: string;
    state: string;
    city: string;
    address1: string;
    address2?: string;
    name?: string;
    phone?: string;
}

export interface CheckoutOrderOutput {
    /**
     * Una sola transacción: Stellar admite un único `InvokeHostFunction` por
     * transacción, así que el multicall del checkout ya no existe.
     */
    tx: PreparedTransaction;
}

export interface OrdersFilter {
    status?: OrderStatus[];
    buyerId?: string;
    productId?: string;
    deliveryMethod?: DeliveryMethod;
    eventId?: string;
    startDate?: Date;
    endDate?: Date;
}