import type { ShopifyMoney } from "@/lib/backend/products";

// Pure formatting logic that never depended on Shopify (or now, the
// backend). Formatted with the fr-MA locale — the storefront is French-only
// and prices are in MAD, so amounts render as "899 MAD".
export function formatMoney({ amount, currencyCode }: ShopifyMoney): string | null {
  const value = Number(amount);
  if (Number.isNaN(value)) return null;

  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
