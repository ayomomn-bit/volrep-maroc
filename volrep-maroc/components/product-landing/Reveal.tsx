"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";

// Scroll-reveal wrapper for the product landing page — the `.reveal` /
// `.reveal.in-view` pair from the reference stylesheet, driven by an
// IntersectionObserver instead of the reference's missing script.js.
//
// Safety nets so content can never get stuck invisible: it reveals
// immediately when IntersectionObserver is unavailable, and a timeout
// fallback reveals everything after 1.2s regardless. Reduced-motion users
// also get the content immediately (handled in product-landing.css).
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  threshold = 0.12,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);

    const fallback = window.setTimeout(() => setVisible(true), 1200);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [threshold]);

  return (
    <Tag ref={ref} className={`reveal ${visible ? "in-view" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
