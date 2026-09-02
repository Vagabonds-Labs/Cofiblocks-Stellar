import { Event, logger, RpcProvider, uint256 } from "starknet";

import { 
    AssignRoleEvent, 
    CREATE_PRODUCT_EVENT_SELECTOR, 
    CreateProductEvents, 
    ROASTER_ROLE_SELECTOR,
    PRODUCER_ROLE_SELECTOR,
    ASSIGN_ROLE_EVENT_SELECTOR,
    MarketplaceEventType,
    MarketplaceEvents,
    CheckoutEvents,
    BUY_PRODUCT_EVENT_SELECTOR,
    PAYMENT_SELLER_EVENT_SELECTOR,
    UPDATE_STOCK_EVENT_SELECTOR,
    MINT_EVENT_SELECTOR,
    PaymentSellerEvent,
    BuyProductEvent,
    UpdateStockEvent,
    MintEvent,
    TRANSFER_EVENT_SELECTOR,
    TransferEvent,
} from "./types"
import { HttpException } from "@/exceptions/HttpException";
import { isSameAddress } from "./utils/formatting";
import { ContractFactory } from "./ContractFactory";


class EventsParser {
    private events: Event[]
    private isError: boolean
    
    constructor(events: Event[], isError: boolean = false) {
        this.events = events;
        this.isError = isError;
    }

    public getEvents(): Event[] {
        return this.events;
    }

    public getIsError(): boolean {
        return this.isError;
    }

    public parseCreateProductEvents(): CreateProductEvents {
        const createProductEvents: CreateProductEvents = {
            createProduct: null
        };
        for (const event of this.events) {
            if (event.keys[0] === CREATE_PRODUCT_EVENT_SELECTOR) {
                const createProductEvent = event.data
                createProductEvents.createProduct = {
                    token_id: String(uint256.uint256ToBN({low: createProductEvent[0], high: createProductEvent[1]})),
                    initial_stock: String(uint256.uint256ToBN({low: createProductEvent[2], high: createProductEvent[3]})),
                    owner: String(createProductEvent[4]),
                    price: String(uint256.uint256ToBN({low: createProductEvent[5], high: createProductEvent[6]})),
                };
            }
        }
        return createProductEvents;
    }

    public parseAssignRoleEvents(): AssignRoleEvent {
        const assignRoleEvent: AssignRoleEvent = {
            role: '',
            account: '',
        };
        for (const event of this.events) {
            if (event.keys[0] === ASSIGN_ROLE_EVENT_SELECTOR) {
                if (event.data[0] === PRODUCER_ROLE_SELECTOR) {
                    assignRoleEvent.role = 'PRODUCER';
                } else if (event.data[0] === ROASTER_ROLE_SELECTOR) {
                    assignRoleEvent.role = 'ROASTER';
                }
                assignRoleEvent.account = String(event.data[1]);
            }
        }
        return assignRoleEvent;
    }

    public parseCheckoutEvents(): CheckoutEvents {
        const buyProductEvents: BuyProductEvent[] = [];
        const paymentSellerEvents: PaymentSellerEvent[] = [];
        const updateStockEvents: UpdateStockEvent[] = [];
        const mintEvents: MintEvent[] = [];
        const transferEvents: TransferEvent[] = [];

        const contractFactory = new ContractFactory();
        const usdcAddress = contractFactory.getUSDCERC20Service().contractAddress;

        for (const event of this.events) {
            if (event.keys[0] === BUY_PRODUCT_EVENT_SELECTOR) {
                buyProductEvents.push({
                    token_id: String(uint256.uint256ToBN({low: event.data[0], high: event.data[1]})),
                    amount: String(uint256.uint256ToBN({low: event.data[2], high: event.data[3]})),
                    buyer: String(event.data[4]),
                });
            } else if (event.keys[0] === PAYMENT_SELLER_EVENT_SELECTOR) {
                paymentSellerEvents.push({
                    token_ids:[ String(uint256.uint256ToBN({low: event.data[1], high: event.data[2]})) ],
                    seller: String(event.data[3]),
                    payment: String(uint256.uint256ToBN({low: event.data[4], high: event.data[5]})),
                });
            } else if (event.keys[0] === UPDATE_STOCK_EVENT_SELECTOR) {
                updateStockEvents.push({
                    token_id: String(uint256.uint256ToBN({low: event.data[0], high: event.data[1]})),
                    new_stock: String(uint256.uint256ToBN({low: event.data[2], high: event.data[3]})),
                });
            } else if (event.keys[0] === MINT_EVENT_SELECTOR) {
                mintEvents.push({
                    token_id: String(uint256.uint256ToBN({low: event.data[0], high: event.data[1]})),
                    amount: String(uint256.uint256ToBN({low: event.data[2], high: event.data[3]})),
                    from: String(event.keys[2]),
                    to: String(event.keys[3]),
                });
            } else if (event.keys[0] === TRANSFER_EVENT_SELECTOR && event.keys.length === 3) {
                transferEvents.push({
                    from: String(event.keys[1]),
                    to: String(event.keys[2]),
                    amount: String(uint256.uint256ToBN({low: event.data[0], high: event.data[1]})),
                    token: isSameAddress(usdcAddress,event.from_address) ? 'USDC': event.from_address,
                });
            }
        }
        return {
            buyProduct: buyProductEvents,
            paymentSeller: paymentSellerEvents,
            updateStock: updateStockEvents,
            mint: mintEvents,
            transfer: transferEvents,
        };
    }

    public parseEvents(eventsType: MarketplaceEventType): MarketplaceEvents {
        if (this.isError) {
            return [];
        }
        switch (eventsType) {
            case 'CREATE_PRODUCT':
                return this.parseCreateProductEvents();
            case 'ASSIGN_ROLE':
                return this.parseAssignRoleEvents();
            case 'CHECKOUT':
                return this.parseCheckoutEvents();
            default:
                return this.events;
        }
    }
}

export class ChainEventsClient {
    private provider: RpcProvider

    constructor() {
        this.provider = new RpcProvider({
            nodeUrl: process.env.RPC_URL
        });
    }

    public async getTransactionEvents(tx_hash: string): Promise<EventsParser> {
        try {
            const receipt = await this.provider.getTransactionReceipt(tx_hash)
            if (receipt.isError()) {
                return new EventsParser([], true);
            }
            const events = receipt.value.events;
            return new EventsParser(events, receipt.isError());
        } catch (error) {
            throw new HttpException(400, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
        }
    }
}