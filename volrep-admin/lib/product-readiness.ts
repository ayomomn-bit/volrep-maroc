import type { StudioCompleteness } from "@/lib/types";

// "Can this product be sold on its Volrep product page?" — the readiness
// meter in Product Studio's Vue d'ensemble.
//
// It tracks ONLY what a sale actually requires: a price and at least one
// image. A Lirya marketing page is an acquisition channel, not a
// prerequisite — a product with a complete Volrep PDP and no Lirya page is
// fully ready. Landing-page state is still surfaced in Vue d'ensemble via
// its own indicator card, just not in this bar.
export type ProductReadiness = {
  checks: { priced: boolean; hasMedia: boolean };
  ready: number;
  total: number;
  isReady: boolean;
  missing: number;
};

export function productReadiness(c: StudioCompleteness): ProductReadiness {
  const checks = { priced: c.commerce.priced, hasMedia: c.media.ready };
  const values = Object.values(checks);
  const ready = values.filter(Boolean).length;
  return {
    checks,
    ready,
    total: values.length,
    isReady: ready === values.length,
    missing: values.length - ready,
  };
}
