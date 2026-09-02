import { GrindType, ProductStatus, Prisma, ProductTxType, OrderStatus } from "@prisma/client";

import { HttpException } from "@/exceptions/HttpException";
import { CreateOrderRequest } from "@/schemas/orderSchemas";
import { DbProducts, DbProductTx, DbUsers, DbOrders } from "@/services/db";
import { CreateProductData, ProductFilters } from "./types/Products";
import { mapProductToResponse } from "@/services/mappers/ordersMappers";
import { OrderItemResponse } from "./types/Orders";
import * as OnChainProductsService from '@/services/onchain/OnChainProductsService';
import * as NotificationService from './NotificationService';
import { ChainClient } from "@/lib/CofiblocksContracts/ChainClient";
import { logger } from "@/lib/logger";
import { TransactionDetails, TransactionType } from "@/lib/CofiblocksContracts/types/transactions";
import { createStripeProduct, disableStripeProduct } from "../stripe/stripeService";
import { DbStripeProducts } from "../db/dbStripeProducts";

const dbProducts = new DbProducts();
const dbProductTx = new DbProductTx();
const dbUsers = new DbUsers();
const dbOrders = new DbOrders();
const dbStripeProducts = new DbStripeProducts();

export async function assertProductStockIsEditable(productId: string, userId: string) {
  const product = await dbProducts.findProductByIdForUpdate(productId);
  if (!product) {
    throw new HttpException(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  }
  if (product.ownerId !== userId) {
    throw new HttpException(403, 'You are not the owner', 'PRODUCT_OWNERSHIP_REQUIRED');
  }
  if (product.status === 'PUBLISHED') {
    throw new HttpException(403, 'Cannot edit published product', 'PRODUCT_NOT_HIDDEN');
  }
  return product;
}

export async function assertProductsArePurchasable(data: CreateOrderRequest) {
    // Get all products and validate stock availability
    const productIds = data.products.map((item) => item.id);
    const products = await dbProducts.findProductsByIds(productIds);
    // Check if all products exist
    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      throw new HttpException(
        404,
        `Products not found: ${missingIds.join(', ')}`,
        'PRODUCTS_NOT_FOUND'
      );
    }

    // Validate stock availability and product status
    const stockErrors: string[] = [];
    for (const item of data.products) {
      const product = products.find((p) => p.id === item.id);
      if (!product) continue;

      // Check if product is published
      if (product.status !== 'PUBLISHED') {
        stockErrors.push(`Product ${product.title} is not available for purchase`);
      }

      const availableStock = product.currentStock - product.reservedStock;
      if (availableStock < item.amount) {
        stockErrors.push(
          `Insufficient stock for product ${product.title}. Available: ${product.currentStock}, Requested: ${item.amount}`
        );
      }
    }

    if (stockErrors.length > 0) {
      throw new HttpException(400, stockErrors.join('; '), 'INSUFFICIENT_STOCK');
    }
}

/**
   * Create a new product
   * Requires the user to have a sellerType (PRODUCER or ROASTER)
   */
export async function createProduct(
  userId: string,
  data: CreateProductData
): Promise<OrderItemResponse['product']> {
  // Check if tokenId already exists
  if (data.tokenId && data.tokenId !== '') {
    const existingProduct = await dbProducts.findProductsByTokenId(data.tokenId);
    if (existingProduct.length > 0) {
      throw new HttpException(
        409,
        'Product with this token ID already exists',
        'DUPLICATE_TOKEN_ID'
      );
    }
  }

  const createData = {...data, ownerId: userId};
  const product = await dbProducts.createProduct(createData);

  // Return product without owner info
  return mapProductToResponse(product);
}

export async function deployProduct(
  initialStock: number,
  priceUSD: number,
  product_id: string,
  caller_wallet: string,
  is_roaster: boolean,
): Promise<ChainClient> {
  let producerAddress = caller_wallet;
  const product = await dbProducts.findProductByIdWithFarm(product_id);
  if (!product) {
    throw new HttpException(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  }

  if (is_roaster) {
    const farmOwner = product.farm.ownerId;
    const owner = await dbUsers.findUserById(farmOwner);
    if (!owner?.walletAddress) {
      throw new HttpException(404, 'Farm owner wallet address not found', 'FARM_OWNER_WALLET_ADDRESS_NOT_FOUND');
    }
    producerAddress = owner.walletAddress;
  }

  const transactionDetails = await OnChainProductsService.createProductTx(
    initialStock, priceUSD, producerAddress, product.id
  );

  return transactionDetails;
}

export async function getAllProducts(status?: ProductStatus, filters?: ProductFilters): Promise<
OrderItemResponse['product'][]> {
  // Build the where clause
  const whereConditions: any[] = [];
  if (status) {
    whereConditions.push({ status });
  }

  if (status === ProductStatus.PUBLISHED) {
    whereConditions.push({
      currentStock: {
        gt: 0,
      },
    });
  }

  if (filters?.search) {
    whereConditions.push({
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }
  if (filters?.region) {
    whereConditions.push({
      farm: {
        region: filters.region,
      },
    });
  }

  // Roast level filter
  if (filters?.roastLevel) {
    whereConditions.push({ roastLevel: filters.roastLevel });
  }

  // Price range filters
  const priceConditions: any = {};
  if (filters?.minPrice !== undefined) {
    priceConditions.gte = filters.minPrice;
  }
  if (filters?.maxPrice !== undefined) {
    priceConditions.lte = filters.maxPrice;
  }
  if (Object.keys(priceConditions).length > 0) {
    whereConditions.push({ price: priceConditions });
  }

  // Grind type filter
  if (filters?.grindType) {
    const normalized = filters.grindType.toUpperCase() as GrindType;
    whereConditions.push({ grindType: normalized });
  }

  // Build final where clause
  const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

  const products = await dbProducts.findProductsWithFilters(where as Prisma.ProductWhereInput);

  // Map products to exclude owner information
  return products.map((product) => mapProductToResponse(product));
}

export async function getProductsByUser(userId: string): Promise<OrderItemResponse['product'][]> {
  // Get products owned by this user
  const products = await dbProducts.findProductsByOwnerId(userId);
  if (!products) {
    return [];
  }
  return products.map((product) => mapProductToResponse(product));
}

/**
 * Update product status
 */
export async function updateProductStatus(productId: string, status: ProductStatus): Promise<void> {
  await dbProducts.updateProductStatus(productId, status);
}

/**
 * Update product onchain data (tokenId, price, currentStock)
 */
export async function updateProductOnchainData(
  productId: string,
  data: { tokenId: string; price: number; currentStock: number }
): Promise<void> {
  const updateData = {
    tokenId: data.tokenId,
    price: data.price,
    currentStock: data.currentStock,
  };
  await dbProducts.updateProductOnchainData(productId, updateData);
}

/**
 * Get product by ID (for ownership verification)
 */
export async function getProductById(productId: string) {
  return await dbProducts.findProductByIdForOwnership(productId);
}

/**
 * Get product by ID with full details (public endpoint)
 * Returns product with farm information, without owner information
 */
export async function getProductByIdPublic(productId: string): Promise<OrderItemResponse['product'] | null> {
  const product = await dbProducts.findProductByIdWithFarm(productId);
  if (!product) {
    return null;
  }
  return mapProductToResponse(product);
}

/**
 * Update product (title, description, currentStock, imageUrl, status)
 * Requires the user to be the owner of the product
 */
export async function updateProduct(
  productId: string,
  userId: string,
  data: {
    title?: string;
    description?: string;
    imageUrl?: string;
    status?: ProductStatus;
  }
): Promise<OrderItemResponse['product']> {
  const product = await dbProducts.findProductByIdForUpdate(productId);
  if (!product) {
    throw new HttpException(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  }

  if (product.ownerId !== userId) {
    throw new HttpException(403, 'You are not the owner', 'PRODUCT_OWNERSHIP_REQUIRED');
  }

  if (product.reservedStock > 0 && data.status === ProductStatus.HIDDEN) {
    throw new HttpException(400, 'Cannot hide product with reserved stock', 'PRODUCT_HAS_RESERVED_STOCK');
  }

  const updatedProduct = await dbProducts.updateProduct(productId, data);

  return mapProductToResponse(updatedProduct);
}


/**
 * Delete product
 * Requires the user to be the owner of the product
 */
export async function deleteProduct(productId: string, userId: string): Promise<void> {
  // Verify product exists and get ownership info
  const product = await dbProducts.findProductByIdForUpdate(productId);
  if (!product) {
    throw new HttpException(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  }

  // Verify caller is the owner of the product
  if (product.ownerId !== userId) {
    throw new HttpException(
      403,
      'You are not the owner of this product',
      'PRODUCT_OWNERSHIP_REQUIRED'
    );
  }

  const orders = await dbOrders.getProductOrders(productId, [OrderStatus.PAID, OrderStatus.IN_DELIVERY]);
  if (orders.length > 0) {
    throw new HttpException(
      400, 'Cannot delete product with pending delivery orders', 'PRODUCT_HAS_PENDING_DELIVERY_ORDERS'
    );
  }

  if (product.reservedStock > 0) {
    throw new HttpException(400, 'Cannot delete product with reserved stock', 'PRODUCT_HAS_RESERVED_STOCK');
  }

  // Disable stripe product
  const stripeProduct = await dbStripeProducts.findStripeProductByProductId(productId);
  if (stripeProduct) {
    logger.info('Disabling stripe product for product: ' + stripeProduct.stripeProductId);
    await dbStripeProducts.disableStripeProduct(productId);
    await disableStripeProduct(stripeProduct.stripeProductId);
  }

  // Delete product
  await dbProducts.deleteProduct(productId);
}

export async function getProductsByIds(productIds: string[]) {
  return await dbProducts.findProductsByIds(productIds);
}


export async function verifyProductDeployment(
  productId: string, callerId: string, callerWalletAddress: string, txHash: string
): Promise<{ initialStock: number, tokenId: string, price: number }> {
  // Verify product exists and get ownership info
  const product = await dbProducts.findProductByIdForOwnership(productId);
  if (!product) {
    throw new HttpException(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  }

  // Verify caller is the owner of the product
  if (product.ownerId !== callerId) {
    throw new HttpException(403, 'You are not the owner of this product', 'PRODUCT_OWNERSHIP_REQUIRED');
  }

  // Check if tx_hash already exists (this will throw if it does)
  const txExists = await dbProductTx.findProductTxByTxHash(txHash);
  if (txExists) {
    throw new HttpException(409, 'Transaction hash already exists', 'DUPLICATE_TX_HASH');
  }

  const { initialStock, tokenId, price } = await OnChainProductsService.verifyCreateProductTx(
    callerWalletAddress, txHash
  );

  // Store the transaction in productTX table with type="CREATE"
  await dbProductTx.createProductTx({
    productId: productId,
    txType: ProductTxType.CREATE,
    senderId: callerId,
    txHash: txHash,
  });

  // Update product with onchain data (tokenId, price, currentStock) and status
  const updatedProduct = await dbProducts.updateProductOnchainData(productId, {
    tokenId: tokenId,
    price: price,
    currentStock: initialStock,
  });

  // Update product status to PUBLISHED
  await dbProducts.updateProductStatus(productId, ProductStatus.PUBLISHED);
  await NotificationService.pushInfoNotification(callerId, 'PRODUCT_DEPLOYMENT_SUCCESSFUL', []);

  // Create stripe product
  let stripeReady = false;
  try {
    const stripeProduct = await createStripeProduct(
      updatedProduct.title, updatedProduct.description || '', updatedProduct.price, updatedProduct.imageUrl || ''
    );
    await dbStripeProducts.insertNewProduct(product.id, stripeProduct.productId, stripeProduct.priceId);
    stripeReady = true;
  } catch (error) {
    logger.error('Error creating stripe product: ' + error);
  }

  return { initialStock, tokenId, price };
}


export async function updateProductStock(productId: string, userId: string, updatedStock: number): 
Promise<{ tx: TransactionDetails | null, txType: TransactionType | null }> {
  const product = await assertProductStockIsEditable(productId, userId);
  if (product.status === ProductStatus.CREATION_REQUEST) {
    logger.info('Product not deployed yet, updating current stock');
    await dbProducts.updateProduct(productId, { currentStock: updatedStock });
    return { tx: null, txType: null };
  }

  if (!product.tokenId) {
    throw new HttpException(500, 'Product has no token ID', 'INTERNAL_SERVER_ERROR');
  }
  const currentStockOnChain = await OnChainProductsService.getProductStock(product.tokenId);
  logger.info('Current stock on chain: ' + currentStockOnChain + ' for tokenId: ' + product.tokenId);
  if ( currentStockOnChain < updatedStock ) {
    const requiredMint = updatedStock - currentStockOnChain;
    logger.info('Minting is required for the new stock, need to mint ' + requiredMint);
    const tx = await OnChainProductsService.mintProductStock(product.tokenId, requiredMint);
    return { tx: tx.getTransactionDetails(), txType: tx.getTransactionType() };
  }
 
  logger.info('Requested stock is less than current stock, updating current stock');
  await dbProducts.updateProduct(productId, { currentStock: updatedStock });
  return { tx: null, txType: null };
}


export async function syncProductStock(productId: string): Promise<void> {
  const product = await dbProducts.findProductByIdForUpdate(productId);
  if (!product) {
    throw new HttpException(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  }
  if (!product.tokenId) {
    logger.info('Product is not deployed yet, skipping stock sync');
    return;
  }
  // We just need to sync the amount of tokens on chain with the amount of products in the database
  const currentStockOnChain = await OnChainProductsService.getProductStock(product.tokenId);
  if (currentStockOnChain === product.currentStock) {
    logger.info('Product stock is already synced');
    return;
  }
  if (currentStockOnChain < product.reservedStock) {
    throw new HttpException(500, 'Product stock onchain is less than reserved stock', 'PRODUCT_STOCK_LESS_THAN_RESERVED_STOCK');
  }
  logger.info('Updating product stock from ' + product.currentStock + ' to ' + currentStockOnChain);
  await dbProducts.updateProduct(productId, { currentStock: currentStockOnChain });
  
}
