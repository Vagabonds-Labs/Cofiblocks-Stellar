import { Router, Request, Response } from 'express';
import { GrindType, ProductStatus } from '@prisma/client';

import { HttpException } from '@/exceptions/HttpException';
import { authenticate, validate, uploadImage, requireSeller } from '@/middleware';
import { 
  deployProductSchema,
  deployCallbackSchema,
  productFiltersSchema,
  createProductSchema,
  updateProductSchema,
  updateProductStockSchema,
  updateProductStockCallbackSchema
} from '@/schemas/productSchemas';
import { StorageService } from '@/services/storage/StorageService';
import { CreateProductData } from '@/services/app/types/Products';
import { successResponse } from '@/utils/formatting';
import * as ProductService from '@/services/app/ProductService';
import * as FarmService from '@/services/app/FarmsService';
import * as OnChainEnvService from '@/services/onchain/OnChainEnvService';
import * as NotificationService from '@/services/app/NotificationService';
import { logger } from '@/lib/logger';

const router = Router();
const storageService = new StorageService();


router.get('/', validate(productFiltersSchema), async (req: Request, res: Response, next) => {
  const filters = req.query;
  const products = await ProductService.getAllProducts(ProductStatus.PUBLISHED, filters);
  successResponse(res, products, 'Products fetched successfully', 200);
});


router.get('/my-products', authenticate, async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;
  const products = await ProductService.getProductsByUser(userId);
  successResponse(res, products, 'Products fetched successfully', 200);
});

router.get('/:id', async (req: Request, res: Response, next) => {
  const { id } = req.params;
  const product = await ProductService.getProductByIdPublic(id);
  if (!product) {
    throw new HttpException(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  }
  successResponse(res, product, 'Product fetched successfully', 200);
});


router.post('/', authenticate, requireSeller, uploadImage, validate(createProductSchema), async (req: Request, res: Response, next) => {
    const userId = req.user!.userId;
    const body = req.body;

    // Upload image to Supabase if provided
    let imageUrl: string | undefined;
    if (req.file) {
      imageUrl = await storageService.uploadFile(req.file, undefined, 'products');
    }

    // Prepare product data
    const createProductData: CreateProductData = {
      ...body,
      imageUrl: imageUrl,
      tokenId: '',
      grindType: body.grindType as GrindType,
      contractAddress: OnChainEnvService.getMarketplaceAddress(),
      network: OnChainEnvService.getNetwork(),
      status: ProductStatus.CREATION_REQUEST,
      sales: 0,
    };

    await FarmService.assertFarmExists(body.farmId);
    const product = await ProductService.createProduct(userId, createProductData);
    
    await NotificationService.pushInfoNotification(userId, 'PRODUCT_CREATED_SUCCESSFULLY', []);
    successResponse(res, product, 'Product created successfully', 201);
  }
);


router.post('/deploy', authenticate, requireSeller, validate(deployProductSchema), async (req: Request, res: Response, next) => {
      const { walletAddress, is_roaster } = req.user!;
      const { initialStock, price, product_id } = req.body;
      
      const transactionDetails = await ProductService.deployProduct(
        initialStock, price, product_id, walletAddress, is_roaster
      );
      // Return transaction details using successResponse
      successResponse(res, {
        transaction: transactionDetails.getTransactionDetails(),
        type: transactionDetails.getTransactionType(),
      }, 'Transaction details fetched successfully', 200);
  }
);

/**
 * POST /api/products/deploy/callback
 * Callback endpoint for product deployment transaction
 * Requires authentication and user must be the owner of the product
 * Verifies that the transaction hash is unique and stores it
 * Parses createProduct events to extract token_id, initial_stock, and price
 */
router.post(
  '/deploy/callback',
  authenticate,
  requireSeller,
  validate(deployCallbackSchema),
  async (req: Request, res: Response, next) => {
    const userId = req.user!.userId;
    const { product_id, tx_hash } = req.body;
    const { walletAddress } = req.user!;
    const { initialStock, tokenId, price } = await ProductService.verifyProductDeployment(
      product_id, userId, walletAddress, tx_hash
    );

    // Return success response
    successResponse(res, {
      product_id,
      tx_hash,
      token_id: tokenId,
      price: price,
      initial_stock: initialStock,
    }, 'Product deployment callback processed successfully', 200);
  }
);


router.post('/:id', authenticate, uploadImage, validate(updateProductSchema), async (req: Request, res: Response, next) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { title, description, status } = req.body;

    // Upload image to Supabase if provided
    let imageUrl: string | undefined;
    if (req.file) {
      imageUrl = await storageService.uploadFile(req.file, undefined, 'products');
    }

    const updateData = {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(imageUrl && { imageUrl }),
    };

    const product = await ProductService.updateProduct(id, userId, updateData);
    successResponse(res, product, 'Product updated successfully', 200);
  }
);


router.delete('/:id', authenticate, async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  await ProductService.deleteProduct(id, userId);
  await NotificationService.pushInfoNotification(userId, 'PRODUCT_DELETED_SUCCESSFULLY', []);
  successResponse(res, null, 'Product deleted successfully', 200);
});


router.patch('/:id/stock', authenticate, requireSeller, validate(updateProductStockSchema), async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { currentStock } = req.body;
  const { tx, txType } = await ProductService.updateProductStock(id, userId, currentStock);
  const msg = tx ? "Transaction required to update stock" : "Stock updated successfully";
  successResponse(res, {tx, txType}, msg, 200);
});

router.get('/:id/stock/sync', validate(updateProductStockCallbackSchema), async (req: Request, res: Response, next) => {
  const { id } = req.params;
  await ProductService.syncProductStock(id);
  successResponse(res, null, 'Product stock updated successfully', 200);
});

export default router;
