import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryGallery from "./CategoryGallery";
import type { GalleryItem, GalleryResponse } from "../api/types";

function makeItem(id: string): GalleryItem {
  return {
    id,
    title: `Photo ${id}`,
    description: "",
    altText: `alt ${id}`,
    width: 2400,
    height: 1600,
    aspectRatio: 1.5,
    mimeType: "image/jpeg",
    category: "fog",
    tags: [],
    dominantColor: null,
    blurPlaceholder: null,
    isPublished: true,
    sources: {
      thumbnail: `https://cdn/${id}/t.webp`,
      medium: `https://cdn/${id}/m.webp`,
      original: `https://cdn/${id}/o.jpg`,
    },
  };
}

function mockJson(body: GalleryResponse) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function lastCallUrl(): string {
  const calls = (global.fetch as jest.Mock).mock.calls;
  return String(calls[calls.length - 1][0]);
}

describe("CategoryGallery", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows a loading state, then renders images", async () => {
    mockJson({ items: [makeItem("1")], pagination: { nextCursor: null, hasMore: false } });
    render(<CategoryGallery category="fog" title="Fog" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    const img = (await screen.findByAltText("alt 1")) as HTMLImageElement;
    expect(img.src).toBe("https://cdn/1/m.webp");
  });

  it("shows an empty state when there are no images", async () => {
    mockJson({ items: [], pagination: { nextCursor: null, hasMore: false } });
    render(<CategoryGallery category="fog" title="Fog" />);
    expect(await screen.findByText(/No images yet/i)).toBeInTheDocument();
  });

  it("shows an error state with retry, and retry refetches", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [makeItem("1")],
          pagination: { nextCursor: null, hasMore: false },
        }),
      }) as unknown as typeof fetch;

    render(<CategoryGallery category="fog" title="Fog" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByAltText("alt 1")).toBeInTheDocument();
  });

  it("loads more pages on demand (pagination, no duplicates)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [makeItem("1")],
          pagination: { nextCursor: "cur-1", hasMore: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [makeItem("2"), makeItem("3")],
          pagination: { nextCursor: null, hasMore: false },
        }),
      }) as unknown as typeof fetch;

    render(<CategoryGallery category="fog" title="Fog" />);
    expect(await screen.findByText(/1 \/ 1/)).toBeInTheDocument(); // counter
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(await screen.findByText(/1 \/ 3/)).toBeInTheDocument();

    // The second request carried the cursor from the first page.
    expect(lastCallUrl()).toContain("cursor=cur-1");
  });
});
