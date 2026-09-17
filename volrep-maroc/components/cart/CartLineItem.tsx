"use client";

import Image from "next/image";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { useCartLineMutations } from "@/components/cart/useCartLineMutations";
import { formatMoney } from "@/lib/backend/money";
import type { CartLine } from "@/lib/backend/cart";
import { t } from "@/lib/i18n";

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 12.5A1.5 1.5 0 0 0 10.5 21h3a1.5 1.5 0 0 0 1.5-1.5L16 7" />
    </svg>
  );
}

// Shopify gives single-variant products ("Default Title") a synthetic
// option value that isn't meaningful to a customer — same convention
// VariantPicker already follows on the product page (options with a
// single value render nothing there either).
const DEFAULT_VARIANT_TITLE = "Default Title";

export function CartLineItem({ line }: { line: CartLine }) {
  const { isPending, error, updateQuantity, remove } = useCartLineMutations(line.id);

  const { merchandise } = line;
  const variantLabel = merchandise.title !== DEFAULT_VARIANT_TITLE ? merchandise.title : null;
  const lineTotal = formatMoney(line.cost.totalAmount);
  const unitPrice = formatMoney(merchandise.price);

  return (
    <div
      className={`flex gap-5 py-7 transition-opacity duration-200 ease-out first:pt-0 sm:gap-6 ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-2xl border border-ink/5 bg-[#F8F6F3] sm:w-28">
        {merchandise.image && (
          <Image
            src={merchandise.image.url}
            alt={merchandise.image.altText ?? merchandise.product.title}
            fill
            sizes="112px"
            className="object-contain"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-snug text-ink sm:text-lg">{merchandise.product.title}</h3>
            {variantLabel && <p className="mt-1 text-sm text-slate">{variantLabel}</p>}
            <p className="mt-1 text-sm text-slate">{unitPrice}</p>
          </div>
          <span className="shrink-0 text-base font-semibold text-ink">{lineTotal}</span>
        </div>

        {/* flex-wrap is the safety net: on the narrowest phones the
            quantity stepper (fixed ~160px) and Remove don't both fit on
            one line without it, and this lets Remove drop to its own row
            instead of overflowing rather than relying on exact width math. */}
        <div className="mt-4 flex flex-1 flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <QuantitySelector quantity={line.quantity} disabled={isPending} onChange={updateQuantity} />

          <button
            type="button"
            disabled={isPending}
            onClick={remove}
            aria-label={t.cart.removeAria(merchandise.product.title)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate transition-colors duration-200 ease-out hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <TrashIcon />
            {t.cart.remove}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
