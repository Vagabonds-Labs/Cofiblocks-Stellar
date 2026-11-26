import multer from 'multer';
import { NextFunction, Request, Response } from 'express';

import { HttpException } from '@/exceptions/HttpException';

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// File filter to only allow images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware for single file upload with field name 'logo'
export const uploadLogo = upload.single('logo');

// Middleware for single file upload with field name 'image'
export const uploadImage = upload.single('image');


/**
 * One batch document in the field `file`, kept in memory (10 MB at most). The
 * type is checked by `DocumentsService`; a file over the limit is a 413.
 */
const documentUpload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024, files: 1 } }).single('file');

export const uploadDocument = (req: Request, res: Response, next: NextFunction) =>
  documentUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpException(413, 'The file is larger than 10 MB', 'FILE_TOO_LARGE'));
    }
    if (error) return next(new HttpException(400, (error as Error).message, 'INVALID_UPLOAD'));
    next();
  });
