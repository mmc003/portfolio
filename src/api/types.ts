// Types mirroring the backend gallery DTO (server/src/api/dto.ts).
// Only what the frontend needs; never any internal storage keys/credentials.

export interface ImageSources {
  thumbnail: string | null;
  medium: string | null;
  original: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  altText: string;
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: string;
  category: string | null;
  tags: string[];
  dominantColor: string | null;
  blurPlaceholder: string | null;
  isPublished: boolean;
  sources: ImageSources;
}

export interface GalleryPagination {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface GalleryResponse {
  items: GalleryItem[];
  pagination: GalleryPagination;
}
