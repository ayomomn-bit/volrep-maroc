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
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 12.5A1.5 1.5 0 0 0 10.5 21h3a1.5 1.5 0 0 0 1.5-1.5L16 7" />
    </svg>
  );
}

// Same "Default Title" convention CartLineItem/VariantPicker follow.
const DEFAULT_VARIANT_TITLE = "Default Title";

// Compact counterpart to CartLineItem — same reused QuantitySelector and
// useCartLineMutations, but denser spacing/type scale to fit the drawer's
// ~380px interior instead of the full /cart page's wide column.
export function CartDrawerLineItem({ line }: { line: CartLine }) {
  const { isPending, error, updateQuantity, remove } = useCartLineMutations(line.id);

  const { merchandise } = line;
  const variantLabel = merchandise.title !== DEFAULT_VARIANT_TITLE ? merchandise.title : null;
  const lineTotal = formatMoney(line.cost.totalAmount);

  return (
    <div
      className={`flex gap-4 py-6 transition-opacity duration-200 ease-out first:pt-6 last:pb-0 ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border border-ink/5 bg-[#F8F6F3]">
        {merchandise.image && (
          <Image
            src={merchandise.image.url}
            alt={merchandise.image.altText ?? merchandise.product.title}
            fill
            sizes="80px"
            className="object-contain"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-snug text-ink">{merchandise.product.title}</h3>
            {variantLabel && <p className="mt-0.5 text-xs text-slate">{variantLabel}</p>}
          </div>
          <span className="shrink-0 text-sm font-semibold text-ink">{lineTotal}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <QuantitySelector quantity={line.quantity} disabled={isPending} onChange={updateQuantity} />

          <button
            type="button"
            disabled={isPending}
            onClick={remove}
            aria-label={t.cart.removeAria(merchandise.product.title)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate transition-colors duration-200 ease-out hover:text-ink disabled:pointer-events-none disabled:opacity-40"
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
