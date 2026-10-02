// Pure pricing helpers for the product editor. Display-only — the backend
// is authoritative for what is actually stored and charged.

export const MONEY_RE = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * Discount percentage of `price` against `compareAt`, rounded to an int, or
 * null when there is no genuine discount (missing / non-numeric compareAt,
 * or compareAt not strictly above price).
 */
export function discountPercent(price: string | number, compareAt: string | number | null | undefined): number | null {
  if (compareAt === null || compareAt === undefined || compareAt === "") return null;
  const p = Number(price);
  const c = Number(compareAt);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c <= p) return null;
  return Math.round((1 - p / c) * 100);
}

export type SimpleCommerceError = "priceRequired" | "priceInvalid" | "compareAtInvalid" | "compareAtNotAbovePrice";

/**
 * Client-side mirror of the backend's simple-product commerce validation
 * (assertMoneyString / assertCompareAtAbovePrice in
 * volrep-backend/src/services/admin/variants.ts, reused by
 * services/admin/products.ts for a simple product's price/compare-at) —
 * catches the obvious mistakes before the round trip, same spirit as
 * VariantFormModal's inline checks. The backend remains authoritative.
 */
export function validateSimpleCommerce(price: string, compareAt: string): SimpleCommerceError | null {
  const p = price.trim();
  const c = compareAt.trim();
  if (!p) return "priceRequired";
  if (!MONEY_RE.test(p)) return "priceInvalid";
  if (c && !MONEY_RE.test(c)) return "compareAtInvalid";
  if (c && Number(c) <= Number(p)) return "compareAtNotAbovePrice";
  return null;
}
