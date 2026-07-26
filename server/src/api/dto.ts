/**
 * Response mapping. The gallery/admin DTO exposes only what the frontend needs
 * (including derived public URLs) — never internal credentials or raw object
 * keys. URLs come from the storage adapter, so this works for local + S3.
 */
import { ImageRecord } from "../db/imageRepository";
import { readTags } from "../db/imageRepository";
import { ImageStorage } from "../storage/types";

export interface ImageSources {
  thumbnail: string | null;
  medium: string | null;
  original: string;
}

export interface ImageDTO {
  id: string;
  title: string;
  description: string;
  altText: string;
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: string;
  category: string | null;
  capturedAt: string | null;
  tags: string[];
  dominantColor: string | null;
  blurPlaceholder: string | null;
  isPublished: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  sources: ImageSources;
}

export function toImageDTO(image: ImageRecord, storage: ImageStorage): ImageDTO {
  return {
    id: image.id,
    title: image.title,
    description: image.description,
    altText: image.altText,
    width: image.width,
    height: image.height,
    aspectRatio: image.aspectRatio,
    mimeType: image.mimeType,
    category: image.category,
    capturedAt: image.capturedAt ? image.capturedAt.toISOString() : null,
    tags: readTags(image),
    dominantColor: image.dominantColor,
    blurPlaceholder: image.blurPlaceholder,
    isPublished: image.isPublished,
    displayOrder: image.displayOrder,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
    sources: {
      original: storage.getPublicUrl(image.objectKey),
      medium: image.mediumObjectKey ? storage.getPublicUrl(image.mediumObjectKey) : null,
      thumbnail: image.thumbnailObjectKey ? storage.getPublicUrl(image.thumbnailObjectKey) : null,
    },
  };
}
