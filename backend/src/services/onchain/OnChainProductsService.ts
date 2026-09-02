import { ChainEventsClient, ContractFactory } from "@/lib/CofiblocksContracts";
import { ChainClient } from "@/lib/CofiblocksContracts/ChainClient";
import { PaymentToken } from "@/lib/CofiblocksContracts/types/transactions";
import { hexToText, isSameAddress, stringToAddress, usdToWei, weiToUsd, multicall } from "@/lib/CofiblocksContracts/utils";
import { HttpException } from "@/exceptions/HttpException";
import { logger } from "@/lib/logger";
import { ListedProduct } from "./types/products";

const contractFactory = new ContractFactory();
const chainEventsClient = new ChainEventsClient();

export async function increaseMarketplaceAllowanceTx(amountUSD: number): Promise<ChainClient> {
    const marketplace = contractFactory.getMarketplaceService();
    const usdcContract = contractFactory.getUSDCERC20Service();
    const tx = await usdcContract.increaseAllowance(usdToWei(amountUSD), marketplace.contractAddress);
    return tx;
}

export async function buyProductTx(tokenId: string, tokenAmount: number, buyer: string): Promise<ChainClient> {
    const marketplace = contractFactory.getMarketplaceService();
    const tx = marketplace.buyProduct(BigInt(tokenId), BigInt(tokenAmount), buyer);
    return tx;
}

export async function transferFeeToMarketplaceTx(feeUSD: number): Promise<ChainClient> {
    const usdcContract = contractFactory.getUSDCERC20Service();
    const marketplace = contractFactory.getMarketplaceService();
    const tx = usdcContract.transfer(usdToWei(feeUSD), marketplace.contractAddress);
    return tx;
}

export async function buyProductsTxs(
    tokenIds: string[],
    tokenAmounts: number[],
    orderTotalUSD: number,
    deliveryFeeUSD: number,
    buyerWalletAddress: string,
): Promise<ChainClient[]> {
    if (tokenIds.length !== tokenAmounts.length) {
        throw new Error('tokenIds and tokenAmounts must have the same length');
    }
    const txs = [];
    const allowanceTx = await increaseMarketplaceAllowanceTx(orderTotalUSD);
    txs.push(allowanceTx);
    for (let i = 0; i < tokenIds.length; i++) {
        if (!tokenIds[i]) {
            throw new Error('tokenIds[i] is null');
        }
        const tx = await buyProductTx(tokenIds[i], tokenAmounts[i], buyerWalletAddress);
        txs.push(tx);
    }
    if (deliveryFeeUSD > 0) {
        const deliveryFeeTx = await transferFeeToMarketplaceTx(deliveryFeeUSD);
        txs.push(deliveryFeeTx);
    }
    return txs;
}

function findEventByTokenId(tokenId: string | null, events: any[]): any | null {
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

export async function verifyBuyProductEvents(
    tokenIds: string[], tokenAmounts: number[], buyerWalletAddress: string, txHash: string
): Promise<void> {
    const events = (await chainEventsClient.getTransactionEvents(txHash)).parseCheckoutEvents();
    if (!events.buyProduct) {
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

export async function verifyDeliveryPayment(
    orderTotalUSD: number,
    deliveryPriceUSD: number,
    txHash: string
): Promise<void> {
    const contractFactory = new ContractFactory();
    const marketplaceAddress = contractFactory.getMarketplaceService().contractAddress;
    const events = (await chainEventsClient.getTransactionEvents(txHash)).parseCheckoutEvents();
    if (!events.transfer) {
        throw new HttpException(400, 'No transfer events found', 'NO_TRANSFER_EVENTS_FOUND');
    }
    const totalPaid = events.transfer.reduce((sum, event) => {
        if (event.token === 'USDC' && isSameAddress(event.to, marketplaceAddress)) {
        return sum + Number(event.amount);
        }
        return sum;
    }, 0);
    if (totalPaid < orderTotalUSD + (deliveryPriceUSD ?? 0)) {
        logger.error(
        'Delivery not paid, total: ' + totalPaid + ' expected: ' + (orderTotalUSD + (deliveryPriceUSD ?? 0))
        );
        throw new HttpException(400, 'Delivery not paid', 'DELIVERY_NOT_PAID');
    }
}

export async function createProductTx(
    initialStock: number,
    priceUSD: number,
    associatedProducer: string,
    shortDescription: string
): Promise<ChainClient> {
    const shortDescriptionFelt = "0x" + Buffer.from(shortDescription.slice(0, 30), 'utf8').toString('hex');
    const marketplace = contractFactory.getMarketplaceService();
    const transactionDetails = marketplace.createProduct(
      BigInt(initialStock), usdToWei(priceUSD), associatedProducer, shortDescriptionFelt
    );
    return transactionDetails;
}


export async function verifyCreateProductTx(
    requesterWalletAddress: string,
    txHash: string
): Promise<{ initialStock: number, tokenId: string, price: number }> {
    // Check tx hash events for createProduct event
  const events = (await chainEventsClient.getTransactionEvents(txHash)).parseCreateProductEvents();
  if (!events.createProduct) {
    logger.error('No createProduct event found in transaction, events: ' + JSON.stringify(events));
    throw new HttpException(400, 'No createProduct event found in transaction', 'EVENT_NOT_FOUND');
  }
  if (!isSameAddress(events.createProduct.owner, requesterWalletAddress)) {
    logger.error('Owner mismatch, event: ' + events.createProduct.owner + ' caller wallet: ' + requesterWalletAddress);
    throw new HttpException(403, 'Event owner does not match caller wallet', 'OWNER_MISMATCH');
  }

  // Convert initial_stock to number
  const initialStock = parseInt(events.createProduct.initial_stock, 10);
  if (isNaN(initialStock)) {
    logger.error('Invalid initial_stock value in event, event: ' + events.createProduct.initial_stock);
    throw new HttpException(400, 'Invalid initial_stock value in event', 'INVALID_STOCK');
  }
  return { initialStock, tokenId: events.createProduct.token_id, price: weiToUsd(BigInt(events.createProduct.price)) };
}

export async function mintProductStock(tokenId: string, amount: number): Promise<ChainClient> {
    const marketplace = contractFactory.getMarketplaceService();
    const tx = marketplace.addStock(BigInt(tokenId), BigInt(amount));
    return tx;
}

export async function getProduct(tokenId: string): Promise<any> {
    const marketplace = contractFactory.getMarketplaceService();
    const product = await marketplace.getProduct(BigInt(tokenId)).call();
    const productData = product as ListedProduct;

    const productParsed = {
      tokenId: productData.token_id.toString(),
      stock: productData.stock.toString(),
      sells: productData.sells.toString(),
      price_usdc: productData.price_usdc.toString(),
      price_usdc_with_fee: productData.price_usdc_with_fee.toString(),
      is_producer: productData.is_producer,
      owner: stringToAddress(productData.owner),
      associated_producer: stringToAddress(productData.associated_producer),
      short_description: hexToText(productData.short_description),
      is_available: productData.is_available,
    }

    return productParsed;
}

export async function getProductStock(tokenId: string): Promise<number> {
  const product = await getProduct(tokenId);
  return Number(product.stock);
}

export async function multicallBuyProductsTxs(
  txs: ChainClient[], walletAddress: string, privateKey: string
): Promise<string> {
  const txHash = await multicall(walletAddress, privateKey, txs);
  return txHash;
}
