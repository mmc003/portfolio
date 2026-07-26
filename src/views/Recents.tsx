import React from "react";
import "./Recents.css";
import CategoryGallery from "../components/CategoryGallery";

// Gallery is now API-driven (no Webpack require.context / bundled images).
// Categories match the folder names used by the migration script.
const Recents: React.FC = () => {
  return (
    <div>
      <div className="subtitle">Recents</div>
      <div className="recents-container">
        <CategoryGallery
          category="vancouver"
          title={
            <>
              Van <br />
              Vancouver, British Columbia <br />
              Portra400
            </>
          }
        />

        <CategoryGallery
          category="fog"
          title={
            <>
              Fog <br />
              UCSD <br />
              Portra400
            </>
          }
        />

        <CategoryGallery
          category="dujiangyan"
          title={
            <>
              Dujiangyan <br /> Chengdu, China <br />
              HP5400 Pushed 2 Stops
            </>
          }
        />

        <CategoryGallery
          category="danang-boats"
          title={
            <>
              Banana Boats <br />
              Da Nang, Vietnam <br />
              TMAX400 Pushed 2 Stops <br /> Colorplus200
            </>
          }
        />
      </div>
    </div>
  );
};

export default Recents;
