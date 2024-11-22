import React from "react";
import "./Recents.css";

import wkw from "../imgs/wongkarwai-watch-order.jpg";

const Recents: React.FC = () => {
  // const imgs = [wkw];
  return (
    <div>
      <div className="subtitle">Recent Work</div>
      {/* <div className="gallery-grid">
        {imgs.map((image, index) => (
          <img
            key={index}
            src={image}
            alt={`${index + 1}`}
            className="gallery-image"
          />
        ))}
      </div> */}
    </div>
  );
};

export default Recents;
