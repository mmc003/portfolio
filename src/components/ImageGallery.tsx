import React, { useState } from "react";
import "./ImageGallery.css";
import ResponsiveImage from "./ResponsiveImage";
import type { GalleryItem } from "../api/types";

interface ImageGalleryProps {
  images: GalleryItem[];
}

// Carousel that shows one image at a time. Only the active slide is mounted,
// so the browser never downloads off-screen originals.
const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) return null;

  const handlePrev = () =>
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  const handleNext = () =>
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));

  const item = images[currentIndex];

  return (
    <div>
      <div className="gallery-container">
        <button
          onClick={handlePrev}
          className="arrow-button"
          aria-label="Previous image"
        >
          ❮
        </button>
        <div className="gallery-image">
          <ResponsiveImage
            item={item}
            sizes="(max-width: 800px) 100vw, 800px"
            eager={currentIndex === 0}
          />
        </div>
        <button
          onClick={handleNext}
          className="arrow-button"
          aria-label="Next image"
        >
          ❯
        </button>
      </div>
      <div className="image-counter">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
};

export default ImageGallery;
