import React from "react";
import "./Recents.css";
import ImageGallery from "../components/ImageGallery";

const importAll = (requireContext: ReturnType<WebpackRequire["context"]>) =>
  requireContext.keys().map(requireContext);

const Recents: React.FC = () => {
  const dujiangyan = importAll(
    require.context("../imgs/dujiangyan", false, /\.(png|jpe?g|svg)$/)
  );

  const danang_boats = importAll(
    require.context("../imgs/danang-boats", false, /\.(png|jpe?g|svg)$/)
  );

  return (
    <div>
      <div className="subtitle">Recents</div>
      <div className="recents-container">
        <div className="gallery">
          <div className="gallery-title">
            Dujiangyan <br /> Chengdu, China <br />
            HP5400 Pushed 2 Stops
          </div>
          <ImageGallery images={dujiangyan} />
        </div>

        <div className="gallery">
          <div className="gallery-title">
            Banana Boats <br />
            Da Nang, Vietnam <br />
            TMAX400 Pushed 2 Stops <br /> Colorplus200
          </div>
          <ImageGallery images={danang_boats} />
        </div>

        {/* <div className="gallery">
          <div className="gallery-title">Banana Boats <br />Da Nang, Vietnam <br />TMAX400 Pushed 2 Stops <br /> Colorplus200</div>
          <ImageGallery images={danang_boats} />
        </div> */}
      </div>
    </div>
  );
};

export default Recents;
