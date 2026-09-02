import { Router, Request, Response } from 'express';

import { authenticate, validate, uploadLogo, requireSeller } from '@/middleware';
import { createFarmSchema } from '@/schemas/farmSchemas';
import { HttpException } from '@/exceptions/HttpException';
import { StorageService } from '@/services/storage';
import * as NotificationsService from '@/services/app/NotificationService';
import * as FarmsService from '@/services/app/FarmsService';
import { CreateFarmEntry } from '@/services/db/dbFarms';
import { successResponse } from '@/utils/formatting';

const router = Router();
const storageService = new StorageService();


router.get('/', async (req: Request, res: Response, next) => {
  const farms = await FarmsService.getAllFarms();
  successResponse(res, farms);
});

router.get('/my-farms', authenticate, requireSeller, async (req: Request, res: Response, next) => {
  const userId = req.user!.userId;
  const farms = await FarmsService.getFarmsByUser(userId);
  successResponse(res, farms);
});

router.get('/:id', async (req: Request, res: Response, next) => {
  const { id } = req.params;
  const farm = await FarmsService.getFarmById(id);
  successResponse(res, farm);
});

router.delete('/:id', authenticate, requireSeller, async (req: Request, res: Response, next) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  await FarmsService.deleteFarm(userId, id);
  successResponse(res, null, 'Farm deleted successfully');
});

router.post('/', authenticate, requireSeller, uploadLogo, validate(createFarmSchema), async (req: Request, res: Response, next) => {
    const userId = req.user!.userId;
    const { name, region, country, altitude, coordinates, website } = req.body;

    const altitudeNum = parseInt(altitude, 10);
    // Validate website URL if provided
    if (website && website.trim()) {
      try {
        new URL(website);
      } catch {
        throw new HttpException(400, 'Invalid website URL format', 'INVALID_WEBSITE_URL_FORMAT');
      }
    }

    // Upload logo to Supabase if provided
    let logoUrl: string | undefined;
    if (req.file) {
      logoUrl = await storageService.uploadFile(req.file);
    }

    const createFarmData: CreateFarmEntry = {
      name: name.trim(),
      sales: 0,
      region: region.trim(),
      country: country.trim(),
      altitude: altitudeNum,
      coordinates: coordinates.trim(),
      website: website?.trim() || undefined,
      logoUrl: logoUrl,
      ownerId: userId,
    };
    const farm = await FarmsService.createFarm(createFarmData);

    await NotificationsService.pushInfoNotification(userId, 'FARM_CREATED_SUCCESSFULLY', [farm.name]);
    successResponse(res, farm, 'Farm created successfully');
  }
);

export default router;

