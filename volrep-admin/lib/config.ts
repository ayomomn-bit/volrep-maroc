// Runtime configuration read from public env vars. Nothing here is a secret
// — the browser only ever holds URLs; the sole credential is the httpOnly
// `volrep_admin_session` cookie.
//
// COD_SYSTEM_URL points at the SEPARATE COD operations system. Volrep Admin
// is a store-control centre: order confirmation, customer calling, delivery
// and operational fulfilment all live in the COD system, and the order
// screens link out to it rather than rebuilding those flows. A proper
// Intégrations settings screen will replace this env var in a later phase;
// until then it is configured through `NEXT_PUBLIC_COD_SYSTEM_URL`.

export const COD_SYSTEM_URL = (process.env.NEXT_PUBLIC_COD_SYSTEM_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

// Deep link to a single order in the COD system. Returns null when the COD
// system URL is not configured, so callers render a disabled state.
export function codOrderUrl(orderNumber: string): string | null {
  if (!COD_SYSTEM_URL) return null;
  const ref = orderNumber.replace(/^#/, "");
  return `${COD_SYSTEM_URL}/orders/${encodeURIComponent(ref)}`;
}

// Public base URL of the Volrep storefront (volrep-maroc). Used only to
// build the "Aperçu" link for the Product Studio "Page produit" tab. Defaults
// to the local dev storefront; set NEXT_PUBLIC_STOREFRONT_URL for staging /
// production.
export const STOREFRONT_URL = (process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000")
  .trim()
  .replace(/\/+$/, "");

// {STOREFRONT_URL}/products/{handle}/preview?token={signed preview token}
export function productPagePreviewUrl(handle: string, token: string): string {
  return `${STOREFRONT_URL}/products/${encodeURIComponent(handle)}/preview?token=${encodeURIComponent(token)}`;
}

// {STOREFRONT_URL}/preview/homepage?token={signed preview token}
export function homepagePreviewUrl(token: string): string {
  return `${STOREFRONT_URL}/preview/homepage?token=${encodeURIComponent(token)}`;
}
