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
}

export class LocalFilesystemStorage implements ImageStorage {
  private readonly rootDir: string;

  constructor(opts: LocalFsOptions) {
    this.rootDir = path.resolve(opts.rootDir);
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

  /**
   * Returns a path-relative URL (/media/<key>). The route layer absolute-ifies
   * it using the incoming request's host (or PUBLIC_BASE_URL override), so
   * images work regardless of which port/host the API is reached on.
   */
  getPublicUrl(objectKey: string): string {
    assertSafeObjectKey(objectKey);
    return `/media/${objectKey}`;
  }

  /** Used by the static route to set immutable cache headers on unique keys. */
  static readonly cacheHeader = IMMUTABLE_CACHE;
}
