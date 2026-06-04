"use client";

import { useState, useCallback, useEffect } from "react";

export interface CarouselPhoto {
  src: string;
  caption?: string;
}

interface Props {
  photos: CarouselPhoto[];
  country: string;
}

export function PhotoCarousel({ photos, country }: Props) {
  const [current, setCurrent] = useState(0);
  // Main display: lazy-load — only keep current + 1 adjacent preloaded
  const [mainLoaded, setMainLoaded] = useState<Set<number>>(new Set([0]));

  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + photos.length) % photos.length),
    [photos.length]
  );
  const next = useCallback(
    () => setCurrent((c) => (c + 1) % photos.length),
    [photos.length]
  );

  // Preload the next photo in advance so transitions feel instant
  useEffect(() => {
    const adjacent = [
      (current + 1) % photos.length,
      (current - 1 + photos.length) % photos.length,
    ];
    setMainLoaded((prev) => new Set([...prev, current, ...adjacent]));
  }, [current, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  if (!photos.length) return null;

  const photo = photos[current];

  return (
    <div className="select-none">
      {/* Main display */}
      <div
        className="relative rounded-2xl overflow-hidden bg-black/30 group"
        style={{ aspectRatio: "16/10" }}
      >
        {photos.map((p, i) => (
          <img
            key={p.src}
            src={mainLoaded.has(i) ? p.src : undefined}
            alt={p.caption || `${country} photo ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              i === current ? "opacity-100" : "opacity-0"
            }`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ))}

        {/* Caption overlay */}
        {photo.caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pt-8 pb-4 pointer-events-none">
            <p className="text-white/85 text-xs leading-relaxed line-clamp-2">
              {photo.caption}
            </p>
          </div>
        )}

        {/* Counter badge */}
        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white/80 text-xs px-2.5 py-1 rounded-full tabular-nums">
          {current + 1} / {photos.length}
        </div>

        {/* Nav arrows — always visible on touch, hover-reveals on desktop */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 active:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all sm:opacity-0 sm:group-hover:opacity-100 shadow-lg"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 active:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all sm:opacity-0 sm:group-hover:opacity-100 shadow-lg"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip — all thumbnails render immediately (they're tiny) */}
      {photos.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((p, i) => (
            <button
              key={p.src}
              onClick={() => setCurrent(i)}
              style={{ width: 64, height: 44 }}
              className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                i === current
                  ? "border-brand-400 opacity-100 scale-105 shadow-md shadow-brand-400/30"
                  : "border-transparent opacity-45 hover:opacity-75"
              }`}
              aria-label={`Photo ${i + 1}`}
            >
              {/* Always render — thumbnails are 64×44px, bandwidth is cheap */}
              <img
                src={p.src}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility =
                    "hidden";
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Dot indicators (mobile only) */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2 sm:hidden">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === current ? "w-5 bg-brand-400" : "w-1.5 bg-white/25"
              }`}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
