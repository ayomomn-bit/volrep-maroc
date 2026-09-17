import type { ShopifyImage, ShopifyMoney } from "@/lib/backend/products";

// ---------------------------------------------------------------------------
// "Commander maintenant" → /checkout direct-buy context — shared constants
// and pure helpers only (no backend calls), so this module is safe to import
// from both Client Components (LpBuyBox) and server code (app/checkout/page).
//
// The product page links to `/checkout?buy=<handle>&qty=<n>`. That URL IS the
// entire isolated checkout context — there is no cookie, no session token, no
// server-side draft, and nothing written to `volrep_cart_id`. The real
// (single-use) backend cart is only minted at submit time by placeCodOrder()
// and its id is discarded. app/checkout/page.tsx resolves the URL into a
// server-verified DirectBuyContext (price/title/availability from the live
// product — never from the client).
// ---------------------------------------------------------------------------

export const DIRECT_BUY_PARAM = "buy";
export const DIRECT_QTY_PARAM = "qty";

// Matches the backend cart-line schema's own ceiling (z.number().int().max(50)).
export const MAX_DIRECT_QUANTITY = 50;

export type DirectBuyContext = {
  handle: string;
  title: string;
  image: ShopifyImage | null;
  // Unit price for the checkout summary only — the backend recomputes every
  // figure server-side when the order is placed.
  unitPrice: ShopifyMoney;
  quantity: number;
};

export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export function clampDirectQuantity(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_DIRECT_QUANTITY, Math.max(1, Math.floor(n)));
}

// The single Direct Buy URL builder — used by every "Commander maintenant"
// entry point (hero LpBuyBox + mobile LpStickyCta) so there is exactly one
// implementation of the flow.
export function directCheckoutHref(handle: string, quantity: number): string {
  const params = new URLSearchParams({
    [DIRECT_BUY_PARAM]: handle,
    [DIRECT_QTY_PARAM]: String(clampDirectQuantity(quantity)),
  });
  return `/checkout?${params.toString()}`;
}
