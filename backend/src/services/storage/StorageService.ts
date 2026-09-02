import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HttpException } from '@/exceptions/HttpException';

import { validateImageDimensions } from './utils';

export class StorageService {
  private supabase: SupabaseClient;
  private bucketName: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Role Key must be set in environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'farm-logos';
  }

  /**
   * Upload a file to Supabase Storage
   * @param file - File buffer or file object
   * @param fileName - Name for the file in storage
   * @param folder - Optional folder path in the bucket
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    file: Express.Multer.File,
    fileName?: string,
    folder: string = 'farms'
  ): Promise<string> {
    try {
      // Validate image dimensions before uploading
      await validateImageDimensions(file.buffer);

      // Generate unique filename if not provided
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const finalFileName = fileName || `${timestamp}-${randomString}.${fileExtension}`;
      const filePath = `${folder}/${finalFileName}`;

      // Upload file to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        throw new HttpException(500, `Failed to upload file: ${error.message}`, 'STORAGE_UPLOAD_ERROR');
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new HttpException(500, 'Failed to get public URL for uploaded file', 'STORAGE_URL_ERROR');
      }

      return urlData.publicUrl;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(500, 'Failed to upload file to storage', 'STORAGE_ERROR');
    }
  }

  /**
   * Delete a file from Supabase Storage
   * @param filePath - Path to the file in storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        throw new HttpException(500, `Failed to delete file: ${error.message}`, 'STORAGE_DELETE_ERROR');
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(500, 'Failed to delete file from storage', 'STORAGE_ERROR');
    }
  }
}

