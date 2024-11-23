import React from "react";
import "./Recents.css";

import img1 from "../imgs/9684-1_03.jpg";
import img2 from "../imgs/9684-1_07.jpg";
import img3 from "../imgs/9684-1_06.jpg";
import img4 from "../imgs/9684-1_10.jpg";
import img5 from "../imgs/9684-1_17.jpg";
import img6 from "../imgs/9684-1_20.jpg";
import img7 from "../imgs/9684-1_21.jpg";



const Recents: React.FC = () => {
  const imgs = [img1, img2, img3, img4,  img6, img5,img7];
  return (
    <div>
      <div className="subtitle">Recent Work</div>
      <div className="gallery-grid">
        {imgs.map((image, index) => (
          <img
            key={index}
            src={image}
            alt={`${index + 1}`}
            className="gallery-image"
          />
        ))}
      </div>
    </div>
  );
};

export default Recents;
