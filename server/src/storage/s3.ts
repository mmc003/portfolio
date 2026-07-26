/**
 * S3-compatible storage adapter (AWS S3 / Cloudflare R2 / Backblaze B2 / MinIO).
 *
 * Uses @aws-sdk/client-s3. A client-like object is injectable so the adapter can
 * be unit-tested without a real bucket (see s3.test.ts).
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  ImageStorage,
  StoredImage,
  UploadImageInput,
} from "./types";
import { assertSafeObjectKey } from "./objectKey";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

export interface S3StorageOptions {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** If set (e.g. a CDN), URLs use this base; otherwise fall back to endpoint/bucket. */
  publicBaseUrl?: string;
  /** Force path-style addressing (required for MinIO; harmless for S3/R2). */
  forcePathStyle?: boolean;
  /** Inject a client for testing. */
  client?: S3Client;
}

export class S3Storage implements ImageStorage {
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicBaseUrl?: string;
  private readonly endpoint?: string;
  private readonly client: S3Client;

  constructor(opts: S3StorageOptions) {
    this.bucket = opts.bucket;
    this.region = opts.region;
    this.publicBaseUrl = opts.publicBaseUrl?.replace(/\/$/, "");
    this.endpoint = opts.endpoint?.replace(/\/$/, "");
    this.client =
      opts.client ??
      new S3Client({
        region: opts.region,
        endpoint: opts.endpoint,
        forcePathStyle: opts.forcePathStyle ?? true,
        credentials: {
          accessKeyId: opts.accessKeyId,
          secretAccessKey: opts.secretAccessKey,
        },
      });
  }

  async upload(input: UploadImageInput): Promise<StoredImage> {
    assertSafeObjectKey(input.objectKey);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        Body: input.data,
        ContentType: input.mimeType,
        CacheControl: input.cacheControl ?? IMMUTABLE_CACHE,
      })
    );
    return {
      objectKey: input.objectKey,
      size: input.data.byteLength,
      mimeType: input.mimeType,
      url: this.getPublicUrl(input.objectKey),
    };
  }

  async delete(objectKey: string): Promise<void> {
    assertSafeObjectKey(objectKey);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey })
    );
  }

  getPublicUrl(objectKey: string): string {
    assertSafeObjectKey(objectKey);
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${objectKey}`;
    if (this.endpoint) return `${this.endpoint}/${this.bucket}/${objectKey}`;
    // Fallback to AWS virtual-hosted style.
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${objectKey}`;
  }

  // createSignedUploadUrl (browser-direct uploads) is intentionally omitted for
  // now: it requires @aws-sdk/s3-request-presigner (not installed). The primary
  // upload path is server-side multipart. To enable direct uploads later, add
  // that dependency and implement presigned PUT URLs + a server completion
  // endpoint. The interface marks this method optional (types.ts).

  static readonly cacheHeader = IMMUTABLE_CACHE;
}
