/**
 * Upload orchestration: validate → process (Sharp) → upload master + derivatives
 * → persist metadata. Handles partial failures: if storage succeeds but the DB
 * insert fails (or vice versa), uploaded objects are deleted and the error is
 * rethrown. Storage/processing is also rolled back if any object upload fails.
 */
import { getEnv } from "../config/env";
import { getStorage } from "../storage";
import { ImageStorage } from "../storage/types";
import { getRepo } from "../db/client";
import { ImageRepository } from "../db/imageRepository";
import { generateKeySet } from "../storage/objectKey";
import { validateUpload } from "../validation/upload";
import { processImage } from "./imageProcessing";
import { sha256Hex } from "../utils/hash";
import { HttpError } from "../middleware/error";
import { ImageRecord } from "../db/imageRepository";
import { getLogger } from "../utils/logger";

export interface UploadImageInput {
  buffer: Buffer;
  originalFilename: string;
  declaredMime?: string;
  category?: string;
  title?: string;
  description?: string;
  altText?: string;
  tags?: string[];
  isPublished?: boolean;
  displayOrder?: number;
}

export interface UploadDeps {
  storage?: ImageStorage;
  repo?: ImageRepository;
}

const IMMUTABLE = "public, max-age=31536000, immutable";

export async function uploadImage(
  input: UploadImageInput,
  deps: UploadDeps = {}
): Promise<ImageRecord> {
  const env = getEnv();
  const storage = deps.storage ?? getStorage();
  const repo = deps.repo ?? getRepo();
  const log = getLogger();

  // 1. Validate size + real file signature (throws HttpError on failure).
  const detectedMime = validateUpload({
    buffer: input.buffer,
    declaredMime: input.declaredMime,
    sizeBytes: input.buffer.byteLength,
    maxBytes: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  });

  // 2. Dedup by content hash (idempotent uploads / migration).
  const contentHash = sha256Hex(input.buffer);
  const existing = await repo.findByContentHash(contentHash);
  if (existing) {
    log.info({ contentHash, id: existing.id }, "upload skipped: duplicate content hash");
    return existing;
  }

  // 3. Process with Sharp (auto-orient, strip EXIF, derivatives).
  let processed: Awaited<ReturnType<typeof processImage>>;
  try {
    processed = await processImage(input.buffer, {
      sourceMime: detectedMime,
      thumbnailWidth: env.IMAGE_THUMBNAIL_WIDTH,
      mediumWidth: env.IMAGE_MEDIUM_WIDTH,
      derivativeFormat: env.IMAGE_DERIVATIVE_FORMAT,
    });
  } catch (err) {
    log.warn({ message: err instanceof Error ? err.message : String(err) }, "image processing failed");
    throw new HttpError(400, "Could not decode or process image", "invalid_image");
  }

  // 4. Generate safe, content-unique object keys.
  const keys = generateKeySet({
    originalFilename: input.originalFilename,
    category: input.category,
    originalExt: processed.master.ext,
    derivativeExt: processed.medium.ext,
  });

  // 5. Upload master + derivatives, tracking keys for rollback.
  const uploaded: string[] = [];
  const tryUpload = async (objectKey: string, data: Buffer, mimeType: string) => {
    try {
      await storage.upload({ data, objectKey, mimeType, cacheControl: IMMUTABLE });
      uploaded.push(objectKey);
    } catch (err) {
      log.error({ objectKey, message: err instanceof Error ? err.message : String(err) }, "storage upload failed; rolling back");
      await cleanup(storage, uploaded);
      throw new HttpError(502, "Failed to store image", "storage_failure");
    }
  };

  await tryUpload(keys.original, processed.master.data, processed.master.mimeType);
  await tryUpload(keys.medium, processed.medium.data, processed.medium.mimeType);
  await tryUpload(keys.thumbnail, processed.thumbnail.data, processed.thumbnail.mimeType);

  // 6. Persist metadata; roll back storage on DB failure.
  try {
    const record = await repo.create({
      title: input.title?.trim() || stripExt(input.originalFilename),
      description: input.description ?? "",
      altText: input.altText ?? input.title?.trim() ?? stripExt(input.originalFilename),
      originalFilename: input.originalFilename,
      category: input.category ?? null,
      objectKey: keys.original,
      thumbnailObjectKey: keys.thumbnail,
      mediumObjectKey: keys.medium,
      width: processed.master.width,
      height: processed.master.height,
      aspectRatio: processed.aspectRatio,
      mimeType: processed.master.mimeType,
      fileSize: processed.master.data.byteLength,
      displayOrder: input.displayOrder ?? 0,
      isPublished: input.isPublished ?? false,
      contentHash,
      dominantColor: processed.dominantColor,
      blurPlaceholder: processed.blurPlaceholder,
      tags: input.tags,
    });
    return record;
  } catch (err) {
    log.error({ message: err instanceof Error ? err.message : String(err) }, "DB insert failed; rolling back storage");
    await cleanup(storage, uploaded);
    throw new HttpError(500, "Failed to persist image metadata", "persistence_failure");
  }
}

async function cleanup(storage: ImageStorage, keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((k) =>
      storage.delete(k).catch(() => {
        /* best-effort; logged by caller if needed */
      })
    )
  );
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
