import { DeliveryMethod, OrderStatus } from "../orders/types";

export interface OrdersFilter {
    status?: OrderStatus[];
    buyer_id?: string;
    product_id?: string;
    delivery_method?: DeliveryMethod;
    event_id?: string;
    start_date?: Date;
    end_date?: Date;
}