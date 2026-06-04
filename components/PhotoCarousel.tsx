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
  const [mainLoaded, setMainLoaded] = useState<Set<number>>(new Set([0]));
  const [lightbox, setLightbox] = useState(false);

  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + photos.length) % photos.length),
    [photos.length]
  );
  const next = useCallback(
    () => setCurrent((c) => (c + 1) % photos.length),
    [photos.length]
  );

  // Preload adjacent photos for smooth transitions
  useEffect(() => {
    setMainLoaded((prev) =>
      new Set([
        ...prev,
        current,
        (current + 1) % photos.length,
        (current - 1 + photos.length) % photos.length,
      ])
    );
  }, [current, photos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") setLightbox(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightbox) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  if (!photos.length) return null;

  const photo = photos[current];

  return (
    <>
      <div className="select-none">
        {/* Main carousel image — click to open lightbox */}
        <div
          className="relative rounded-2xl overflow-hidden bg-black/30 group cursor-pointer"
          style={{ aspectRatio: "16/10" }}
          onClick={() => setLightbox(true)}
          title="Click to expand"
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
                (e.currentTarget as HTMLImageElement).style.visibility =
                  "hidden";
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

          {/* Expand hint on hover */}
          <div className="absolute top-3 left-3 bg-black/40 text-white/60 text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            ⤢ expand
          </div>

          {/* Nav arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 active:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all sm:opacity-0 sm:group-hover:opacity-100 shadow-lg"
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 active:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all sm:opacity-0 sm:group-hover:opacity-100 shadow-lg"
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip — all rendered immediately */}
        {photos.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {photos.map((p, i) => (
              <button
                key={p.src}
                onClick={() => setCurrent(i)}
                style={{ width: 64, height: 44 }}
                className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                  i === current
                    ? "border-brand-400 opacity-100 scale-105 shadow-md shadow-brand-400/30"
                    : "border-transparent opacity-45 hover:opacity-75"
                }`}
                aria-label={`Photo ${i + 1}`}
              >
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

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          {/* Image + caption — stopPropagation so clicking image doesn't close */}
          <div
            className="relative flex flex-col items-center max-w-[92vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photo.src}
              alt={photo.caption || `${country} photo`}
              className="max-h-[82vh] max-w-[92vw] object-contain rounded-xl shadow-2xl"
            />
            {photo.caption && (
              <p className="text-white/75 text-sm mt-4 text-center max-w-2xl leading-relaxed px-2">
                {photo.caption}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white/70 text-xs px-3 py-1.5 rounded-full tabular-nums">
            {current + 1} / {photos.length}
          </div>

          {/* Prev / Next */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors shadow-lg"
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors shadow-lg"
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}

          {/* Tap backdrop hint (mobile) */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none">
            tap outside to close
          </p>
        </div>
      )}
    </>
  );
}
