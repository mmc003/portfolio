// Thin API client. No data-fetching library — just fetch + AbortController.
// API base is configurable via REACT_APP_API_BASE_URL (build-time); defaults to
// the local backend.
import type { GalleryItem, GalleryResponse } from "./types";

export const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL as string | undefined) || "http://localhost:4000";

/** Fetch a page of published gallery images, optionally filtered by category. */
export async function fetchGallery(opts: {
  category?: string;
  limit?: number;
  cursor?: string | null;
  signal?: AbortSignal;
}): Promise<GalleryResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(opts.limit ?? 24));
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.category) params.set("category", opts.category);

  const res = await fetch(`${API_BASE_URL}/api/images?${params.toString()}`, {
    signal: opts.signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Gallery request failed (${res.status})`);
  }
  return (await res.json()) as GalleryResponse;
}

/** Fetch a single image by id. */
export async function fetchImage(
  id: string,
  signal?: AbortSignal
): Promise<GalleryItem> {
  const res = await fetch(`${API_BASE_URL}/api/images/${encodeURIComponent(id)}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Image request failed (${res.status})`);
  }
  return (await res.json()) as GalleryItem;
}
