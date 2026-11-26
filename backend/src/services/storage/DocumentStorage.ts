import { promises as fs } from 'fs';
import path from 'path';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';

/**
 * Where batch documents are kept: a private Supabase Storage bucket when
 * `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set, otherwise a local folder
 * (development only). Files are only served through the API, never by URL.
 */
interface Driver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

function supabaseDriver(url: string, key: string): Driver {
  const client: SupabaseClient = createClient(url, key);
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET || 'batch-documents';
  let bucketChecked = false;

  const ensureBucket = async () => {
    if (bucketChecked) return;
    const { data } = await client.storage.getBucket(bucket);
    if (!data) {
      const { error } = await client.storage.createBucket(bucket, { public: false });
      if (error && !/exists/i.test(error.message)) throw error;
      logger.info({ bucket }, 'Created private documents bucket');
    }
    bucketChecked = true;
  };

  return {
    async put(objectKey, body, contentType) {
      await ensureBucket();
      // The key holds the file's SHA-256: the same key is always the same file.
      const { error } = await client.storage.from(bucket).upload(objectKey, body, { contentType, upsert: true });
      if (error) throw new HttpException(502, `Could not store the file: ${error.message}`, 'STORAGE_UPLOAD_ERROR');
    },
    async get(objectKey) {
      const { data, error } = await client.storage.from(bucket).download(objectKey);
      if (error || !data) throw new HttpException(404, 'File not found in storage', 'STORAGE_NOT_FOUND');
      return Buffer.from(await data.arrayBuffer());
    },
  };
}

function localDriver(root: string): Driver {
  const resolve = (key: string) => {
    const file = path.resolve(root, key);
    if (!file.startsWith(path.resolve(root) + path.sep)) throw new HttpException(400, 'Invalid storage key', 'INVALID_KEY');
    return file;
  };
  return {
    async put(key, body) {
      const file = resolve(key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
    },
    async get(key) {
      try {
        return await fs.readFile(resolve(key));
      } catch {
        throw new HttpException(404, 'File not found in storage', 'STORAGE_NOT_FOUND');
      }
    },
  };
}

let driver: Driver | null = null;

function getDriver(): Driver {
  if (driver) return driver;
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
    driver = supabaseDriver(SUPABASE_URL, SUPABASE_SECRET_KEY);
  } else if (process.env.NODE_ENV === 'production') {
    throw new HttpException(500, 'Document storage is not configured', 'STORAGE_NOT_CONFIGURED');
  } else {
    const root = path.resolve(process.env.DOCUMENTS_DIR || 'uploads/documents');
    logger.warn({ root }, 'Supabase Storage is not configured: keeping documents in a local folder');
    driver = localDriver(root);
  }
  return driver;
}

export const DocumentStorage = {
  put: (key: string, body: Buffer, contentType: string) => getDriver().put(key, body, contentType),
  get: (key: string) => getDriver().get(key),
};
