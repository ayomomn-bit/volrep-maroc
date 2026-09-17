"use client";

import { t } from "@/lib/i18n";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Controlled by ProductInfo so AddToCart can read the current quantity
// alongside the selected variant. Also reused by the cart page's line
// items, where `disabled` covers the brief window a quantity mutation is
// in flight against the Shopify Cart API.
export function QuantitySelector({
  quantity,
  onChange,
  min = 1,
  disabled = false,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={t.product.quantity.group}
      className={`inline-flex h-16 shrink-0 items-stretch overflow-hidden rounded-2xl border border-ink/20 bg-white transition-opacity duration-200 ease-out ${disabled ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        aria-label={t.product.quantity.decrease}
        disabled={quantity <= min || disabled}
        onClick={() => onChange(Math.max(min, quantity - 1))}
        className={`flex w-12 items-center justify-center text-lg text-ink transition-colors duration-200 ease-out hover:bg-ink/[0.04] ${FOCUS_RING} disabled:pointer-events-none disabled:opacity-25`}
      >
        −
      </button>
      <span aria-live="polite" className="flex min-w-16 items-center justify-center text-sm font-medium text-ink">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={t.product.quantity.increase}
        disabled={disabled}
        onClick={() => onChange(quantity + 1)}
        className={`flex w-12 items-center justify-center text-lg text-ink transition-colors duration-200 ease-out hover:bg-ink/[0.04] ${FOCUS_RING} disabled:pointer-events-none disabled:opacity-25`}
      >
        +
      </button>
    </div>
  );
}
