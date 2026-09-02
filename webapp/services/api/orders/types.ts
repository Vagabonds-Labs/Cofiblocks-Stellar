import { TransactionDetails } from "../products/types";

export interface CreateOrderItem {
    id: string; // product_id
    amount: number; // amount of items to add
  }
  
  export interface CreateOrderRequest {
    products: CreateOrderItem[];
  }
  
  export interface CreateOrderResponse {
    order_id: string;
  }
  
  export type OrderStatus = 
    | 'PENDING_PAYMENT'
    | 'PAID'
    | 'CANCELLED'
    | 'PENDING_DELIVERY_PAYMENT'
    | 'IN_DELIVERY'
    | 'DELIVERED';

  export type DeliveryMethod = 'EVENT' | 'HOME';

  export interface CofiblocksEvent {
    id: string | null;
    title: string | null;
    location: string | null;
    description: string | null;
    startAt: string | null;
    endAt: string | null;
    timezone: string | null;
    isAllDay: boolean | null;
    urlImage: string | null;
  }

  export interface Delivery {
    id: string | null;
    method: DeliveryMethod | null;
    paymentTxHash: string | null;
    event: CofiblocksEvent;
    price: number | null;
    country: string | null;
    state: string | null;
    city: string | null;
    address1: string | null;
    address2: string | null;
    name: string | null;
    phone: string | null;
  }

  export interface Order {
    id: string;
    buyerId: string;
    status: OrderStatus;
    paymentTx: string | null;
    createdAt: string;
    expiresAt: string;
    isStripeOrder?: boolean;
    delivery: Delivery | null;
    orderItems: OrderItem[];
  }

  export interface OrderWithBuyer extends Order {
    isStripeOrder: boolean;
    buyerName: string | null;
    buyerEmail: string | null;
    buyerWalletAddress: string | null;
  }
  
  export interface OrderItem {
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
      createdAt: string;
      updatedAt: string;
    };
  }
  
  export type GetOrdersResponse = Order[];
  
  export interface GetOrderItemsResponse {
    orderItems: OrderItem[];
  }
  
  export interface GetHomeDeliveryPriceRequest {
    country: string;
    state: string;
    city: string;
  }
  
  export interface GetHomeDeliveryPriceResponse {
      price: number;
  }
  
  export interface CheckoutOrderRequest {
    id: string;
    delivery_event_id?: string;
    stripe_checkout: boolean;
    delivery_home: {
      country: string;
      state: string;
      city: string;
      address1: string;
      address2?: string;
      name: string;
      phone?: string;
    } | null;
  }
  
  export interface CheckoutOrderTransaction {
      tx: TransactionDetails;
      tx_type: string;
  }

  export interface CheckoutOrderResponse {
    txs: CheckoutOrderTransaction[] | null;
    checkoutUrl: string | null;
  }

  export interface CheckoutOrderCallbackRequest {
    id: string;
    tx_hash: string;
  }
