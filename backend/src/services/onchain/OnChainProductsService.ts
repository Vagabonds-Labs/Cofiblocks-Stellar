import { ContractFactory, EventsClient } from '@/lib/StellarContracts';
import { PreparedTransaction } from '@/lib/StellarContracts/types/transactions';
import { isSameAddress, stroopsToUsd, usdToStroops } from '@/lib/StellarContracts/utils';
import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';

const contractFactory = new ContractFactory();
const eventsClient = new EventsClient();

/**
 * Arma la transacción de compra.
 *
 * En Starknet esto devolvía un multicall de N+2 llamadas (`approve`, N ×
 * `buy_product`, `transfer` del envío). Stellar admite un único
 * `InvokeHostFunction` por transacción, así que todo eso colapsa en una sola
 * invocación de `buy_products`. El `approve` desaparece: la autorización viaja
 * por el árbol de invocación.
 */
export async function buyProductsTx(
    tokenIds: string[],
    tokenAmounts: number[],
    deliveryFeeUSD: number,
    buyerWalletAddress: string,
    validForSeconds?: number,
): Promise<PreparedTransaction> {
    if (tokenIds.length !== tokenAmounts.length) {
        throw new Error('tokenIds and tokenAmounts must have the same length');
    }
    if (tokenIds.some((tokenId) => !tokenId)) {
        throw new Error('every order item must have a tokenId');
    }
    const marketplace = contractFactory.getMarketplaceService();
    return marketplace.buyProducts(
        buyerWalletAddress,
        tokenIds,
        tokenAmounts,
        usdToStroops(deliveryFeeUSD),
        validForSeconds,
    );
}

function findEventByTokenId(tokenId: string | null, events: { token_id: string }[]): any | null {
    if (!tokenId) {
      return null;
    }
    for (const event of events) {
      if (event.token_id === tokenId) {
        return event;
      }
    }
    return null;
  }

/**
 * Verifica que la transacción efectivamente compró lo que dice la orden.
 *
 * La lógica de validación es la misma que en Starknet; lo único que cambió es de
 * dónde salen los datos: `getTransaction → resultMetaXdr → scValToNative`, con
 * topics legibles en vez de selectores hexadecimales.
 */
export async function verifyBuyProductEvents(
    tokenIds: string[], tokenAmounts: number[], buyerWalletAddress: string, txHash: string
): Promise<void> {
    const events = (await eventsClient.getTransactionEvents(txHash)).parseCheckoutEvents();
    if (!events.buyProduct || events.buyProduct.length === 0) {
      throw new HttpException(400, 'No buyProduct events found', 'NO_BUY_PRODUCT_EVENTS_FOUND');
    }

    for (let i = 0; i < tokenIds.length; i++) {
        const event = findEventByTokenId(tokenIds[i], events.buyProduct);
        if (!event) {
          throw new HttpException(
            400, 'BuyProduct event not found for product with tokenID: ' + tokenIds[i], 'BUY_PRODUCT_EVENT_NOT_FOUND'
          );
        }
        if (Number(event.amount) !== tokenAmounts[i]) {
          throw new HttpException(400, 'BuyProduct event amount does not match order item amount: ' + tokenIds[i] + ' ' + event.amount + ' ' + tokenAmounts[i], 'BUY_PRODUCT_EVENT_AMOUNT_MISMATCH');
        }
        if (!isSameAddress(event.buyer, buyerWalletAddress)) {
          throw new HttpException(400, 'BuyProduct event buyer does not match order buyer: ' + tokenIds[i] + ' ' + event.buyer + ' ' + buyerWalletAddress, 'BUY_PRODUCT_EVENT_BUYER_MISMATCH');
        }
    }
}

/**
 * Verifica que el envío se haya pagado.
 *
 * El evento `buy_batch` lleva `total_paid` y `delivery_fee` explícitos, así que
 * ya no hace falta sumar los `transfer` del token como en Starknet.
 */
export async function verifyDeliveryPayment(
    orderTotalUSD: number,
    deliveryPriceUSD: number,
    txHash: string
): Promise<void> {
    const events = (await eventsClient.getTransactionEvents(txHash)).parseCheckoutEvents();
    if (!events.buyBatch) {
        throw new HttpException(400, 'No buyBatch event found', 'NO_BUY_BATCH_EVENT_FOUND');
    }

    const expected = usdToStroops(orderTotalUSD + (deliveryPriceUSD ?? 0));
    const totalPaid = BigInt(events.buyBatch.total_paid);
    if (totalPaid < expected) {
        logger.error(
          'Delivery not paid, total: ' + stroopsToUsd(totalPaid) +
          ' expected: ' + (orderTotalUSD + (deliveryPriceUSD ?? 0))
        );
        throw new HttpException(400, 'Delivery not paid', 'DELIVERY_NOT_PAID');
    }
}

/**
 * Arma la transacción de publicación.
 *
 * `create_product` ya no mintea nada: registra el producto con su stock inicial.
 * `shortDescription` pasa de `felt252` (30 bytes) a `String` de Soroban.
 */
export async function createProductTx(
    sellerWalletAddress: string,
    initialStock: number,
    priceUSD: number,
    associatedProducer: string | null,
    shortDescription: string
): Promise<PreparedTransaction> {
    const marketplace = contractFactory.getMarketplaceService();
    return marketplace.createProduct(
      sellerWalletAddress,
      initialStock,
      usdToStroops(priceUSD),
      associatedProducer,
      shortDescription,
    );
}

export async function verifyCreateProductTx(
    requesterWalletAddress: string,
    txHash: string
): Promise<{ initialStock: number, tokenId: string, price: number }> {
  const events = (await eventsClient.getTransactionEvents(txHash)).parseCreateProductEvents();
  if (!events.createProduct) {
    logger.error('No createProduct event found in transaction, events: ' + JSON.stringify(events));
    throw new HttpException(400, 'No createProduct event found in transaction', 'EVENT_NOT_FOUND');
  }
  if (!isSameAddress(events.createProduct.owner, requesterWalletAddress)) {
    logger.error('Owner mismatch, event: ' + events.createProduct.owner + ' caller wallet: ' + requesterWalletAddress);
    throw new HttpException(403, 'Event owner does not match caller wallet', 'OWNER_MISMATCH');
  }

  const initialStock = parseInt(events.createProduct.initial_stock, 10);
  if (isNaN(initialStock)) {
    logger.error('Invalid initial_stock value in event, event: ' + events.createProduct.initial_stock);
    throw new HttpException(400, 'Invalid initial_stock value in event', 'INVALID_STOCK');
  }
  return {
    initialStock,
    tokenId: events.createProduct.token_id,
    price: stroopsToUsd(events.createProduct.price),
  };
}

/**
 * Aumenta el stock del producto.
 *
 * Ya no mintea tokens ERC-1155: `add_stock` es un incremento de contador.
 */
export async function addProductStock(
    sellerWalletAddress: string, tokenId: string, amount: number
): Promise<PreparedTransaction> {
    const marketplace = contractFactory.getMarketplaceService();
    return marketplace.addStock(sellerWalletAddress, tokenId, amount);
}

export async function getProduct(tokenId: string): Promise<any> {
    const marketplace = contractFactory.getMarketplaceService();
    const product = await marketplace.getProduct(tokenId);

    return {
      tokenId: product.token_id,
      stock: product.stock.toString(),
      sells: product.sells.toString(),
      price_usdc: product.price_usdc,
      price_usdc_with_fee: product.price_usdc_with_fee,
      is_producer: product.is_producer,
      owner: product.owner,
      associated_producer: product.associated_producer,
      short_description: product.short_description,
      is_available: product.is_available,
    };
}

export async function getProductStock(tokenId: string): Promise<number> {
  const product = await getProduct(tokenId);
  return Number(product.stock);
}

/**
 * Extiende el TTL del producto para que no lo archive el state archival.
 * Lo dispara el panel admin.
 */
export async function touchProduct(tokenId: string): Promise<string> {
  const marketplace = contractFactory.getMarketplaceService();
  const tx = await marketplace.touchProduct(tokenId);
  const { hash } = await contractFactory.getTxSubmitter().submitAsService(tx);
  return hash;
}
