/**
 * Storage-provider abstraction.
 *
 * All object-storage code is isolated behind this interface so the application
 * never depends on a specific vendor. Two implementations are provided:
 *   - LocalFilesystemStorage (default dev/test, zero external services)
 *   - S3Storage               (AWS S3 / Cloudflare R2 / Backblaze B2 / MinIO)
 *
 * Object keys are content-unique (random UUID) so changed images always receive
 * new URLs and can be cached immutably.
 */
export interface UploadImageInput {
  /** Image bytes to store. */
  data: Buffer;
  /** Pre-generated, safe (path-traversal-free) object key. */
  objectKey: string;
  /** MIME type, e.g. "image/webp". */
  mimeType: string;
  /**
   * Cache-Control directive. Content-unique keys are immutable, so callers
   * typically pass a long max-age + immutable.
   */
  cacheControl?: string;
}

export interface StoredImage {
  objectKey: string;
  size: number;
  mimeType: string;
  /** Public (or locally-served) URL for the object. */
  url: string;
}

export interface SignedUploadResult {
  uploadUrl: string;
  objectKey: string;
  /** How long the signed URL remains valid, in seconds. */
  expiresInSeconds: number;
}

export interface SignedUploadInput {
  objectKey: string;
  mimeType: string;
  expiresInSeconds?: number;
}

export interface ImageStorage {
  upload(input: UploadImageInput): Promise<StoredImage>;
  delete(objectKey: string): Promise<void>;
  getPublicUrl(objectKey: string): string;
  /** Optional: short-lived presigned upload URL for browser-direct uploads. */
  createSignedUploadUrl?(input: SignedUploadInput): Promise<SignedUploadResult>;
}
