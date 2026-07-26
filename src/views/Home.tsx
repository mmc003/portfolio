import React, { useEffect, useState } from "react";
import "./Home.css";
import ResponsiveImage from "../components/ResponsiveImage";
import { fetchGallery } from "../api/client";
import type { GalleryItem } from "../api/types";

// Hero image now comes from the API (no bundled homepage JPEG).
const Home: React.FC = () => {
  const [hero, setHero] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchGallery({ limit: 1, signal: ac.signal })
      .then((r) => setHero(r.items[0] ?? null))
      .catch((e) => {
        if ((e as Error)?.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  if (loading) {
    return <div className="homepage-img homepage-skeleton" role="status" aria-busy="true" />;
  }
  if (error || !hero) {
    return <div className="homepage-empty">No images available.</div>;
  }
  return (
    <div className="homepage-img">
      <ResponsiveImage item={hero} variant="cover" eager sizes="100vw" />
    </div>
  );
};

export default Home;
