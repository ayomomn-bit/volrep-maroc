import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

// Short-lived signed token that authorises the storefront to serve the
// UNPUBLISHED draft of one product's page. Minted only behind requireAdmin
// (routes/admin/product-page.ts) and verified by the storefront page
// endpoint (routes/product-page.ts). It carries no privileges beyond
// "show product X's draft"; it is bound to the product id and expires.
//
// Format: base64url(productId) "." expiryEpochMs "." base64url(HMAC-SHA256)
// The HMAC covers `${productId}.${expiry}` so neither field can be swapped.

const TTL_MS = 30 * 60 * 1000; // 30 minutes

function secret(): string {
  return env.PRODUCT_PAGE_PREVIEW_SECRET ?? env.INTERNAL_API_KEY;
}

function sign(productId: string, expiry: number): string {
  return createHmac("sha256", secret()).update(`${productId}.${expiry}`).digest("base64url");
}

export function mintPreviewToken(
  productId: string,
  now: number = Date.now(),
): { token: string; expiresAt: string } {
  const expiry = now + TTL_MS;
  const token = `${Buffer.from(productId).toString("base64url")}.${expiry}.${sign(productId, expiry)}`;
  return { token, expiresAt: new Date(expiry).toISOString() };
}

export function verifyPreviewToken(
  token: string,
  productId: string,
  now: number = Date.now(),
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [pidPart, expPart, sig] = parts as [string, string, string];

  let decodedPid: string;
  try {
    decodedPid = Buffer.from(pidPart, "base64url").toString("utf8");
  } catch {
    return false;
  }
  if (decodedPid !== productId) return false;

  const expiry = Number(expPart);
  if (!Number.isFinite(expiry) || expiry < now) return false;

  const expected = sign(productId, expiry);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
