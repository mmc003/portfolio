import React from "react";
import { useGallery } from "../hooks/useGallery";
import ImageGallery from "./ImageGallery";

interface CategoryGalleryProps {
  category: string;
  title: React.ReactNode;
  limit?: number;
}

// One category: data hook + carousel + loading/empty/error states + load-more.
const CategoryGallery: React.FC<CategoryGalleryProps> = ({
  category,
  title,
  limit = 24,
}) => {
  const { items, loading, error, hasMore, loadMore, retry } = useGallery({
    category,
    limit,
  });

  return (
    <div className="gallery">
      <div className="gallery-title">{title}</div>
      <div className="gallery-body">
        {loading && items.length === 0 && (
          <div
            className="gallery-skeleton"
            role="status"
            aria-busy="true"
            aria-label={`Loading ${category} images`}
          />
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

        {items.length > 0 && <ImageGallery images={items} />}

        {hasMore && !loading && (
          <button className="gallery-loadmore" onClick={loadMore}>
            Load more
          </button>
        )}
      </div>
    </div>
  );
};

export default CategoryGallery;
