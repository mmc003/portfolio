import React from "react";
import "./Home.css"

import homepage from "../imgs/9684-1_07.jpg"

const Home: React.FC = () => {
  return (
    <div>
      {/* <div className="subtitle">Home</div> */}
      <img src={homepage} alt="" className="homepage-img" />
    </div>
  );
};

export default Home;
