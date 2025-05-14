import React, { useState } from "react";
import "./ImageGallery.css";

// Define the props type
interface ImageGalleryProps {
  images: string[];
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  // State to track the current image index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Navigate to the previous image
  const handlePrev = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  // Navigate to the next image
  const handleNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  return (
    <div>
      <div className="gallery-container">
        <button onClick={handlePrev} className="arrow-button">
          ❮
        </button>
        <img
          src={images[currentIndex]}
          // alt={`Image ${currentIndex + 1}`}
          className="gallery-image"
        />
        <button onClick={handleNext} className="arrow-button">
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
