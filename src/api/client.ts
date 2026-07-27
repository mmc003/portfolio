// Thin API client. No data-fetching library — just fetch + AbortController.
// API base is configurable via REACT_APP_API_BASE_URL (build-time).
//
// When the API is deployed alongside the frontend on Vercel (served at /api/* on
// the same origin), leave REACT_APP_API_BASE_URL unset/empty in production —
// calls then resolve to same-origin relative URLs ("/api/images"), which avoids
// CORS entirely. A non-empty value always wins (e.g. pointing at a separate API
// host). Local dev falls back to the backend on :4000.
import type { GalleryItem, GalleryResponse } from "./types";

const configuredBase = process.env.REACT_APP_API_BASE_URL as string | undefined;

export const API_BASE_URL =
  configuredBase && configuredBase.trim().length > 0
    ? configuredBase
    : process.env.NODE_ENV === "production"
      ? "" // same-origin: API mounted at /api/* on the Vercel domain
      : "http://localhost:4000";

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
