import type { CSSProperties } from "react";
import type { MediaSlot as MediaSlotData } from "@/lib/product-page/types";

// One media position on the product page. Every slot is an unfilled
// placeholder today (the reference photo/video/GIF assets were never
// supplied), rendered exactly as the original `Placeholder` did:
//
//   <div class="lp-ph" aria-hidden="true"><span>…</span></div>
//
// A filled slot (an uploaded product image resolved to a URL by the
// backend, or an external URL pasted in the Studio) renders a plain <img>
// that fills its positioned container. `next/image` is deliberately not
// used here: url slots can point at an arbitrary host, and the container
// sizing is driven entirely by product-landing.css.

const FILL: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

export function MediaSlot({
  slot,
  fallbackLabel = "Visuel à venir",
}: {
  slot: MediaSlotData;
  fallbackLabel?: string;
}) {
  if (slot.kind !== "placeholder" && slot.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={slot.url} alt={slot.alt} style={FILL} loading="lazy" decoding="async" />
    );
  }
  return (
    <div className="lp-ph" aria-hidden="true">
      <span>{slot.placeholderLabel || fallbackLabel}</span>
    </div>
  );
}
