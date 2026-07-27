import React, { useState } from "react";
import "./Recents.css";
import { useGallery } from "../hooks/useGallery";
import ResponsiveImage from "../components/ResponsiveImage";
import Lightbox from "../components/Lightbox";

// Recents: ONE unified gallery — a responsive grid of small, fast-loading
// thumbnails (the browser picks the 500px derivative via srcset). Click any
// thumbnail to open a full-resolution lightbox (prev/next, keyboard, close).
// Replaces the old per-category carousels. Images come from the "recents"
// category, which the migration script assigns from src/imgs/recents.
const Recents: React.FC = () => {
  const { items, loading, error, hasMore, loadMore, retry } = useGallery({
    category: "recents",
    limit: 64,
  });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="recents-view">
      {/* <div className="subtitle"></div> */}

      <div className="recents-grid-wrap">
        {loading && items.length === 0 && (
          <div className="recents-loading" role="status" aria-busy="true">
            Loading…
          </div>
        )}

        {error && (
          <div className="gallery-error" role="alert">
            <span>Couldn’t load images.</span>
            <button className="gallery-retry" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="gallery-empty">No images yet.</div>
        )}

        {items.length > 0 && (
          <div className="recents-grid">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="recents-thumb"
                onClick={() => setOpenIndex(i)}
                aria-label={`Open ${item.title || "image"} at full size`}
              >
                <ResponsiveImage item={item} sizes="240px" />
              </button>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <button className="gallery-loadmore" onClick={loadMore}>
            Load more
          </button>
        )}
      </div>

      {openIndex !== null && (
        <Lightbox
          items={items}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </div>
  );
};

export default Recents;
