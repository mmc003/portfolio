import React from "react";
import { render } from "@testing-library/react";
import ResponsiveImage from "./ResponsiveImage";
import type { GalleryItem } from "../api/types";

function item(over: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: "1",
    title: "A title",
    description: "",
    altText: "Descriptive alt text",
    width: 2400,
    height: 1600,
    aspectRatio: 1.5,
    mimeType: "image/jpeg",
    category: null,
    tags: [],
    dominantColor: "#c83233",
    blurPlaceholder: null,
    isPublished: true,
    sources: {
      thumbnail: "https://cdn/t.webp",
      medium: "https://cdn/m.webp",
      original: "https://cdn/o.jpg",
    },
    ...over,
  };
}

describe("ResponsiveImage", () => {
  it("renders an img with responsive srcset across all variants + alt", () => {
    const { getByAltText } = render(<ResponsiveImage item={item()} />);
    const img = getByAltText("Descriptive alt text") as HTMLImageElement;
    expect(img.src).toBe("https://cdn/m.webp"); // medium fallback
    expect(img.srcset).toContain("500w");
    expect(img.srcset).toContain("1600w");
    expect(img.srcset).toContain("2400w");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
  });

  it("reserves space via aspect-ratio to prevent layout shift", () => {
    const { container } = render(<ResponsiveImage item={item()} />);
    const box = container.querySelector(".responsive-image") as HTMLElement;
    expect(box.style.aspectRatio).toBe("1.5");
  });

  it("loads eagerly when asked (hero)", () => {
    const { getByAltText } = render(<ResponsiveImage item={item()} eager />);
    expect((getByAltText("Descriptive alt text") as HTMLImageElement).getAttribute("loading")).toBe(
      "eager"
    );
  });

  it("falls back to alt text from title when altText is empty", () => {
    const { getByAltText } = render(<ResponsiveImage item={item({ altText: "" })} />);
    expect(getByAltText("A title")).toBeInTheDocument();
  });
});
