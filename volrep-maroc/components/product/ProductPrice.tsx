import type { ShopifyMoney } from "@/lib/backend/products";
import { t } from "@/lib/i18n";

// Presentational — no interactivity of its own. Rendered by ProductInfo
// (a Client Component) with whichever variant's price is currently
// selected.
function formatMoney({ amount, currencyCode }: ShopifyMoney): string | null {
  const value = Number(amount);
  if (Number.isNaN(value)) return null;

  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ProductPrice({
  price,
  compareAtPrice,
}: {
  price: ShopifyMoney;
  compareAtPrice: ShopifyMoney | null;
}) {
  const formattedPrice = formatMoney(price);
  const formattedCompareAtPrice = compareAtPrice ? formatMoney(compareAtPrice) : null;

  // Derived purely from the already-fetched price/compareAtPrice — no new
  // data, just presentation math.
  const compareAtValue = compareAtPrice ? Number(compareAtPrice.amount) : null;
  const discountPercent =
    compareAtValue && compareAtValue > 0 ? Math.round((1 - Number(price.amount) / compareAtValue) * 100) : null;

  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <span className="text-5xl font-bold tracking-tight text-ink">{formattedPrice}</span>
      {formattedCompareAtPrice && (
        <span className="text-xl font-medium text-slate/70 line-through">{formattedCompareAtPrice}</span>
      )}
      {discountPercent !== null && discountPercent > 0 && (
        <span className="rounded-full bg-volt px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-wider text-white">
          {t.product.price.save(discountPercent)}
        </span>
      )}
    </div>
  );
}
