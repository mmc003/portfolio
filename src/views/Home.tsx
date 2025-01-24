import React from "react";
import "./Home.css"

import homepage from "../homepage/000032190025.jpg"

const Home: React.FC = () => {
  return (
    <div>
      {/* <div className="subtitle">Home</div> */}
      <img src={homepage} alt="" className="homepage-img" />
    </div>
  );
};

export default Home;
