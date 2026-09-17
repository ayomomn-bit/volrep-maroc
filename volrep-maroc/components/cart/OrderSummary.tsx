"use client";

import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { formatMoney } from "@/lib/backend/money";
import type { Cart } from "@/lib/backend/cart";
import { t } from "@/lib/i18n";

export function OrderSummary({ cart }: { cart: Cart }) {
  const subtotal = formatMoney(cart.cost.subtotalAmount);

  return (
    <div className="rounded-[24px] border border-ink/10 bg-white p-6 sm:p-8 lg:sticky lg:top-[120px]">
      <h2 className="text-lg font-bold tracking-tight text-ink">{t.cart.orderSummary}</h2>

      <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-6 text-base">
        <span className="text-slate">{t.cart.subtotal}</span>
        <span className="font-semibold text-ink">{subtotal}</span>
      </div>

      <p className="mt-2 text-xs text-slate">{t.cart.taxesNote}</p>

      <CheckoutButton className="mt-6 h-16 w-full" />
    </div>
  );
}
