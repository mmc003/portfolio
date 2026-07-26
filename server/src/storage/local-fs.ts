/**
 * Local filesystem storage adapter.
 *
 * Default for development/testing: zero external services. The production design
 * stays S3-compatible via the shared ImageStorage interface. Files are written
 * under STORAGE_LOCAL_DIR and served via the /media static route on this API.
 */
import { promises as fs } from "fs";
import path from "path";
import { ImageStorage, StoredImage, UploadImageInput } from "./types";
import { assertSafeObjectKey } from "./objectKey";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

export interface LocalFsOptions {
  rootDir: string;
  /** Public origin used to build absolute URLs (e.g. http://localhost:4000). */
  publicBaseUrl: string;
}

export class LocalFilesystemStorage implements ImageStorage {
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;

  constructor(opts: LocalFsOptions) {
    this.rootDir = path.resolve(opts.rootDir);
    this.publicBaseUrl = opts.publicBaseUrl.replace(/\/$/, "");
  }

  private resolve(objectKey: string): string {
    assertSafeObjectKey(objectKey);
    const resolved = path.resolve(this.rootDir, objectKey);
    // Defense-in-depth: ensure the resolved path stays under root.
    if (resolved !== this.rootDir && !resolved.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Object key escapes storage root: ${objectKey}`);
    }
    return resolved;
  }

  async upload(input: UploadImageInput): Promise<StoredImage> {
    const filePath = this.resolve(input.objectKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.data);
    return {
      objectKey: input.objectKey,
      size: input.data.byteLength,
      mimeType: input.mimeType,
      url: this.getPublicUrl(input.objectKey),
    };
  }

  async delete(objectKey: string): Promise<void> {
    assertSafeObjectKey(objectKey);
    const filePath = this.resolve(objectKey);
    await fs.rm(filePath, { force: true });
  }

  getPublicUrl(objectKey: string): string {
    assertSafeObjectKey(objectKey);
    return `${this.publicBaseUrl}/media/${objectKey}`;
  }

  /** Used by the static route to set immutable cache headers on unique keys. */
  static readonly cacheHeader = IMMUTABLE_CACHE;
}
