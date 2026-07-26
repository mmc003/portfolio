// Data hook for a category gallery: handles loading, error, empty, pagination
// (cursor load-more), retry, and request cancellation on unmount. Avoids
// duplicate/stale requests via a monotonic request id.
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGallery } from "../api/client";
import type { GalleryItem } from "../api/types";

export interface UseGalleryOptions {
  category?: string;
  limit?: number;
}

export interface UseGalleryResult {
  items: GalleryItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

export function useGallery({ category, limit = 24 }: UseGalleryOptions): UseGalleryResult {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const cursorRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqId = useRef<number>(0);

  const load = useCallback(
    async (reset: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++reqId.current;

      if (reset) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await fetchGallery({
          category,
          limit,
          cursor: reset ? null : cursorRef.current,
          signal: controller.signal,
        });
        if (id !== reqId.current) return; // a newer request superseded this one
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        cursorRef.current = data.pagination.nextCursor;
        setHasMore(data.pagination.hasMore);
        setError(null);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        if (id !== reqId.current) return;
        setError((e as Error)?.message || "Failed to load images");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [category, limit]
  );

  // (Re)load whenever the category or page size changes.
  useEffect(() => {
    setItems([]);
    cursorRef.current = null;
    setHasMore(false);
    void load(true);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, limit]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) void load(false);
  }, [hasMore, loading, load]);

  const retry = useCallback(() => {
    void load(true);
  }, [load]);

  return { items, loading, error, hasMore, loadMore, retry };
}
