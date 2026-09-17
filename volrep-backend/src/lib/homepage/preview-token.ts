import { mintPreviewToken, verifyPreviewToken } from "../product-page/preview-token.js";

// Homepage Studio draft preview — reuses the EXACT Product Studio
// preview-token mechanism (src/lib/product-page/preview-token.ts: HMAC-SHA256,
// base64url(id).expiry.signature, 30-minute TTL, PRODUCT_PAGE_PREVIEW_SECRET)
// rather than inventing a second token scheme. That module has no
// product-specific logic of its own — it signs and verifies an arbitrary
// string id — so homepage reuses it with one fixed id in place of a product
// id.
//
// Scoping: a real product id is always a uuid drawn from `products`, which
// can never equal this literal string, and the only place that can MINT a
// token for this id is mintHomepagePreviewToken below (gated by
// requireAdmin, see routes/admin/homepage.ts). So a product-page token can
// never unlock the homepage draft, and a homepage token can never unlock a
// product's draft — the two scopes are structurally isolated, not by a
// runtime policy check that could be forgotten.
const HOMEPAGE_PREVIEW_SCOPE_ID = "homepage";

export function mintHomepagePreviewToken(now?: number): { token: string; expiresAt: string } {
  return mintPreviewToken(HOMEPAGE_PREVIEW_SCOPE_ID, now);
}

export function verifyHomepagePreviewToken(token: string, now?: number): boolean {
  return verifyPreviewToken(token, HOMEPAGE_PREVIEW_SCOPE_ID, now);
}
