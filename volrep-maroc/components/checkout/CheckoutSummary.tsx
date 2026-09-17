import Image from "next/image";
import { formatMoney } from "@/lib/backend/money";
import type { Cart } from "@/lib/backend/cart";
import type { ShopifyImage, ShopifyMoney } from "@/lib/backend/products";
import { t } from "@/lib/i18n";

const DEFAULT_VARIANT_TITLE = "Default Title";

type DirectLine = {
  title: string;
  image: ShopifyImage | null;
  unitPrice: ShopifyMoney;
  quantity: number;
};

// Read-only counterpart to OrderSummary.tsx (the /cart page's sidebar) —
// no CheckoutButton here, since submitting this page's own form is the
// checkout action. Same card treatment (rounded-[24px], sticky sidebar)
// for visual consistency with /cart.
//
// `cart` drives the normal flow; `directLine` drives "Commander maintenant"
// (a single product + quantity, no persistent cart). Exactly one is passed.
export function CheckoutSummary({ cart, directLine }: { cart?: Cart; directLine?: DirectLine }) {
  if (directLine) {
    const lineTotal: ShopifyMoney = {
      amount: String(Number(directLine.unitPrice.amount) * directLine.quantity),
      currencyCode: directLine.unitPrice.currencyCode,
    };
    const subtotal = formatMoney(lineTotal);

    return (
      <div className="rounded-[24px] border border-ink/10 bg-white p-6 sm:p-8 lg:sticky lg:top-[120px]">
        <h2 className="text-lg font-bold tracking-tight text-ink">{t.checkout.summary.heading}</h2>

        <div className="mt-6 flex flex-col divide-y divide-black/[0.06]">
          <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
            <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border border-ink/5 bg-[#F8F6F3]">
              {directLine.image && (
                <Image
                  src={directLine.image.url}
                  alt={directLine.image.altText ?? directLine.title}
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              )}
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold text-white"
              >
                {directLine.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{directLine.title}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-ink">{formatMoney(lineTotal)}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-ink/10 pt-6 text-base">
          <span className="text-slate">{t.checkout.summary.subtotal}</span>
          <span className="font-semibold text-ink">{subtotal}</span>
        </div>

        <p className="mt-2 text-xs text-slate">{t.checkout.summary.shippingNote}</p>
      </div>
    );
  }

  if (!cart) return null;

  const subtotal = formatMoney(cart.cost.subtotalAmount);

  return (
    <div className="rounded-[24px] border border-ink/10 bg-white p-6 sm:p-8 lg:sticky lg:top-[120px]">
      <h2 className="text-lg font-bold tracking-tight text-ink">{t.checkout.summary.heading}</h2>

      <div className="mt-6 flex flex-col divide-y divide-black/[0.06]">
        {cart.lines.map((line) => {
          const variantLabel = line.merchandise.title !== DEFAULT_VARIANT_TITLE ? line.merchandise.title : null;
          return (
            <div key={line.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border border-ink/5 bg-[#F8F6F3]">
                {line.merchandise.image && (
                  <Image
                    src={line.merchandise.image.url}
                    alt={line.merchandise.image.altText ?? line.merchandise.product.title}
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold text-white"
                >
                  {line.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{line.merchandise.product.title}</p>
                {variantLabel && <p className="text-xs text-slate">{variantLabel}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink">{formatMoney(line.cost.totalAmount)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-ink/10 pt-6 text-base">
        <span className="text-slate">{t.checkout.summary.subtotal}</span>
        <span className="font-semibold text-ink">{subtotal}</span>
      </div>

      <p className="mt-2 text-xs text-slate">{t.checkout.summary.shippingNote}</p>
    </div>
  );
}
