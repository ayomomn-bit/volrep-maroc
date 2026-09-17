import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { formatMoney } from "@/lib/backend/money";
import type { PlacedOrder } from "@/lib/backend/checkout-actions";
import { t } from "@/lib/i18n";

// Same card language as track-order/OrderResultCard.tsx — this page is
// effectively "the tracking result you get immediately," so it reads as
// part of the same system rather than a new visual pattern.
export function OrderConfirmation({ order }: { order: PlacedOrder }) {
  return (
    <div className="mx-auto max-w-[560px]">
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-volt/10 text-volt"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>

        <h1 className="mt-5 text-4xl uppercase leading-[0.95] tracking-[-0.02em] text-foreground sm:text-5xl">
          {t.checkout.confirmation.title}
        </h1>

        <p className="mt-4 max-w-[440px] text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t.checkout.confirmation.body}
        </p>
      </div>

      <div className="mt-10 rounded-[18px] border border-black/[0.06] bg-white px-6 py-8 shadow-[0_1px_2px_rgba(11,11,11,0.04)] sm:px-8 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t.checkout.confirmation.orderLabel(order.orderNumber)}
          </p>
          <span className="rounded-full bg-volt/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.06em] text-volt">
            {t.checkout.confirmation.codBadge}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-black/[0.06] pt-6">
          <div className="flex items-center justify-between text-[15px]">
            <span className="text-muted-foreground">{t.checkout.confirmation.subtotal}</span>
            <span className="font-medium text-foreground">{formatMoney(order.subtotalAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-[15px]">
            <span className="text-muted-foreground">{t.checkout.confirmation.shipping}</span>
            <span className="font-medium text-foreground">{formatMoney(order.shippingAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 text-base">
            <span className="font-semibold text-foreground">{t.checkout.confirmation.totalOnDelivery}</span>
            <span className="font-bold text-foreground">{formatMoney(order.totalAmount)}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/track-order" variant="primary" size="lg" className="flex-1">
            {t.checkout.confirmation.trackCta}
          </ButtonLink>
          <Link
            href="/"
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-ink/15 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:border-ink/40 sm:h-auto"
          >
            {t.checkout.confirmation.continueShopping}
          </Link>
        </div>
      </div>
    </div>
  );
}
