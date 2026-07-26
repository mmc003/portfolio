// Responsive image with srcset across thumbnail/medium/original, native lazy
// loading, and a reserved aspect-ratio box (with a blur/color placeholder) so
// the layout never shifts while the image loads.
import React from "react";
import "./ResponsiveImage.css";
import type { GalleryItem } from "../api/types";

interface ResponsiveImageProps {
  item: GalleryItem;
  /** Display size hint for the browser's srcset selection. */
  sizes?: string;
  /** Load eagerly (e.g. above-the-fold hero); default lazy. */
  eager?: boolean;
  className?: string;
  /** "ratio" reserves an aspect-ratio box (prevents CLS in grids/carousels);
   *  "cover" fills its parent (parent sets the height) — for full-bleed heroes. */
  variant?: "ratio" | "cover";
}

// Descriptor widths must match the backend derivative widths
// (IMAGE_THUMBNAIL_WIDTH=500, IMAGE_MEDIUM_WIDTH=1600).
const THUMB_W = 500;
const MEDIUM_W = 1600;

function buildSrcSet(item: GalleryItem): string | undefined {
  const candidates: string[] = [];
  if (item.sources.thumbnail) candidates.push(`${item.sources.thumbnail} ${THUMB_W}w`);
  if (item.sources.medium) candidates.push(`${item.sources.medium} ${MEDIUM_W}w`);
  candidates.push(`${item.sources.original} ${item.width}w`);
  return candidates.join(", ");
}

const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  item,
  sizes = "(max-width: 800px) 100vw, 800px",
  eager = false,
  className = "",
  variant = "ratio",
}) => {
  const fallbackSrc = item.sources.medium || item.sources.original;

  // "ratio" reserves the box before the image decodes -> no layout shift.
  // "cover" relies on the parent for height and fills it.
  const style: React.CSSProperties =
    variant === "cover"
      ? {}
      : { aspectRatio: item.aspectRatio || `${item.width} / ${item.height}` };

  return (
    <div
      className={`responsive-image responsive-image--${variant} ${className}`}
      style={style}
      data-placeholder={item.blurPlaceholder ? "blur" : "color"}
    >
      {!item.blurPlaceholder && (
        <div
          className="responsive-image__bg"
          style={{ backgroundColor: item.dominantColor || undefined }}
          aria-hidden="true"
        />
      )}
      {item.blurPlaceholder && (
        <img
          className="responsive-image__blur"
          src={item.blurPlaceholder}
          alt=""
          aria-hidden="true"
        />
      )}
      <img
        className="responsive-image__img"
        src={fallbackSrc}
        srcSet={buildSrcSet(item)}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={item.width}
        height={item.height}
        alt={item.altText || item.title}
      />
    </div>
  );
};

export default ResponsiveImage;
