import sharp from 'sharp';
import { HttpException } from '@/exceptions/HttpException';

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;

/**
 * Validate image dimensions
 * @param fileBuffer - Image file buffer
 * @returns Promise that resolves if valid, rejects if invalid
 */
export async function validateImageDimensions(fileBuffer: Buffer): Promise<void> {
  try {
    const metadata = await sharp(fileBuffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new HttpException(
        400,
        'Unable to read image dimensions',
        'IMAGE_DIMENSION_ERROR'
      );
    }

    if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
      throw new HttpException(
        400,
        `Image dimensions must not exceed ${MAX_WIDTH}x${MAX_HEIGHT} pixels. Current dimensions: ${metadata.width}x${metadata.height}`,
        'IMAGE_TOO_LARGE'
      );
    }
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      400,
      'Invalid image file or unable to process image',
      'IMAGE_PROCESSING_ERROR'
    );
  }
}

