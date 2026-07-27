// Full-resolution image viewer. Opens over the page when a thumbnail is clicked:
// shows the original (largest) source, with prev/next, close, keyboard nav
// (Esc / ← →), a counter, and scroll-lock while open. Clicking the backdrop
// closes; clicking the image or controls does not.
import React, { useCallback, useEffect } from "react";
import "./Lightbox.css";
import type { GalleryItem } from "../api/types";

interface LightboxProps {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const Lightbox: React.FC<LightboxProps> = ({ items, index, onClose, onNavigate }) => {
  const item = items[index];

  const step = useCallback(
    (delta: number) => {
      if (items.length <= 1) return;
      const next = (index + delta + items.length) % items.length;
      onNavigate(next);
    },
    [index, items.length, onNavigate]
  );

  // Keyboard navigation + scroll lock while the lightbox is mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [step, onClose]);

  if (!item) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || "Image preview"}
      onClick={onClose}
    >
      <button
        type="button"
        className="lightbox__btn lightbox__close"
        onClick={onClose}
        aria-label="Close (Esc)"
      >
        &times;
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox__btn lightbox__nav lightbox__nav--prev"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous"
          >
            &#8249;
          </button>
          <button
            type="button"
            className="lightbox__btn lightbox__nav lightbox__nav--next"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next"
          >
            &#8250;
          </button>
        </>
      )}

      <figure className="lightbox__figure" onClick={(e) => e.stopPropagation()}>
        <img
          className="lightbox__img"
          src={item.sources.original}
          alt={item.altText || item.title}
        />
        {item.title && (
          <figcaption className="lightbox__caption">{item.title}</figcaption>
        )}
      </figure>

      {items.length > 1 && (
        <div className="lightbox__counter">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );
};

export default Lightbox;
