/**
 * Storage factory — picks an adapter from STORAGE_DRIVER, isolating all
 * vendor-specific construction behind one function.
 */
import { getEnv } from "../config/env";
import { ImageStorage } from "./types";
import { LocalFilesystemStorage } from "./local-fs";
import { S3Storage } from "./s3";

export function createStorage(env = getEnv()): ImageStorage {
  if (env.STORAGE_DRIVER === "s3") {
    return new S3Storage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION!,
      bucket: env.S3_BUCKET!,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      publicBaseUrl: env.S3_PUBLIC_BASE_URL,
    });
  }
  return new LocalFilesystemStorage({
    rootDir: env.STORAGE_LOCAL_DIR,
    publicBaseUrl: env.PUBLIC_BASE_URL,
  });
}

let cached: ImageStorage | undefined;

export function getStorage(): ImageStorage {
  if (!cached) cached = createStorage();
  return cached;
}

/** Reset the cache (tests). */
export function resetStorageCache(): void {
  cached = undefined;
}

export { LocalFilesystemStorage, S3Storage };
