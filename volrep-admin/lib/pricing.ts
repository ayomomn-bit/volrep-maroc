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
