import React, { useEffect, useState } from "react";
import "./Home.css";
import { fetchGallery } from "../api/client";
import type { GalleryItem } from "../api/types";

// Hero image comes from the API (category "homepage"). Rendered as a plain
// full image (height-constrained, width auto) — no cropping — to match the
// original layout.
const Home: React.FC = () => {
  const [hero, setHero] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchGallery({ category: "homepage", limit: 1, signal: ac.signal })
      .then((r) => setHero(r.items[0] ?? null))
      .catch((e) => {
        if ((e as Error)?.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  if (loading) {
    return <div className="homepage-skeleton" role="status" aria-busy="true" />;
  }
  if (error || !hero) {
    return <div className="homepage-empty">No homepage image set.</div>;
  }

  const src = hero.sources.medium || hero.sources.original;
  const srcSet = [
    hero.sources.medium ? `${hero.sources.medium} 1600w` : null,
    `${hero.sources.original} ${hero.width}w`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <img
      className="homepage-img"
      src={src}
      srcSet={srcSet}
      sizes="90vw"
      alt={hero.altText || hero.title}
    />
  );
};

export default Home;
