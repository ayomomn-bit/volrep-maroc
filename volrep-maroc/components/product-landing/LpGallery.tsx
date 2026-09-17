"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { ShopifyImage } from "@/lib/backend/products";

// Reference `.gallery-section` + `.lightbox` — main image, in-frame prev/next
// arrows, thumbnail strip, dot indicators, and a tap-to-open lightbox modal
// with its own strip / counter / keyboard + outside-click close. The
// reference's version lived in the un-provided script.js; this is a React
// reimplementation with identical class names so the ported CSS drives it.
export function LpGallery({ images, title }: { images: ShopifyImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const count = images.length;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "ArrowRight") go(index + 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, index, go]);

  if (count === 0) {
    return (
      <div className="gallery-main-wrap">
        <div className="gallery-main">
          <div className="lp-ph" aria-hidden="true">
            <span>Visuel produit</span>
          </div>
        </div>
      </div>
    );
  }

  const current = images[index];

  return (
    <div className="gallery-section">
      <div className="gallery-main-wrap">
        {count > 1 && (
          <button type="button" className="gallery-arrow gallery-arrow-left" aria-label="Image précédente" onClick={() => go(index - 1)}>
            ‹
          </button>
        )}
        <button
          type="button"
          className="gallery-main"
          aria-label="Agrandir l’image"
          onClick={() => setLightbox(true)}
        >
          <Image
            src={current.url}
            alt={current.altText ?? title}
            fill
            sizes="(min-width: 1024px) 46vw, 100vw"
            priority
            className="object-cover"
          />
        </button>
        {count > 1 && (
          <button type="button" className="gallery-arrow gallery-arrow-right" aria-label="Image suivante" onClick={() => go(index + 1)}>
            ›
          </button>
        )}
      </div>

      {count > 1 && (
        <>
          <div className="gallery-thumbs">
            {images.map((image, i) => (
              <button
                key={image.url}
                type="button"
                className={`gallery-thumb ${i === index ? "active" : ""}`}
                aria-label={`Afficher l’image ${i + 1} sur ${count}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
              >
                <Image src={image.url} alt="" fill sizes="96px" className="object-cover" />
              </button>
            ))}
          </div>
          <div className="gallery-dots" aria-hidden="true">
            {images.map((image, i) => (
              <button
                key={image.url}
                type="button"
                tabIndex={-1}
                className={`gallery-dot ${i === index ? "active" : ""}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}

      <div
        className={`lightbox-overlay ${lightbox ? "open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLightbox(false);
        }}
      >
        {lightbox && (
          <div className="lightbox-box" role="dialog" aria-modal="true" aria-label={title}>
            <button type="button" className="lightbox-close" aria-label="Fermer" onClick={() => setLightbox(false)}>
              ✕
            </button>
            <div className="lightbox-main">
              {count > 1 && (
                <button type="button" className="lightbox-arrow left" aria-label="Image précédente" onClick={() => go(index - 1)}>
                  ‹
                </button>
              )}
              <Image src={current.url} alt={current.altText ?? title} fill sizes="90vw" className="object-contain" />
              {count > 1 && (
                <button type="button" className="lightbox-arrow right" aria-label="Image suivante" onClick={() => go(index + 1)}>
                  ›
                </button>
              )}
            </div>
            {count > 1 && (
              <div className="lightbox-strip">
                {images.map((image, i) => (
                  <button
                    key={image.url}
                    type="button"
                    className={`lstrip-thumb ${i === index ? "active" : ""}`}
                    aria-label={`Image ${i + 1}`}
                    onClick={() => setIndex(i)}
                  >
                    <Image src={image.url} alt="" fill sizes="52px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
            <p className="lightbox-counter">
              {index + 1} / {count}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
