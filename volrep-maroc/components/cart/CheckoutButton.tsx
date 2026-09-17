"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

// Links to this app's own /checkout page. Previously this was a plain
// navigation to Shopify's per-cart hosted checkoutUrl; V1 is Cash on
// Delivery only, so there's no external checkout to redirect to — the
// destination changed, but the "highest-intent purchase action is a
// styled link" shape (shared by OrderSummary and CartDrawer, matching
// AddToCart's CTA treatment) stays the same.
export function CheckoutButton({
  label = t.checkoutButton.idle,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <ButtonLink
      href="/checkout"
      variant="primary"
      size="lg"
      onClick={() => setIsNavigating(true)}
      aria-disabled={isNavigating}
      className={`rounded-2xl !bg-volt text-base tracking-wide !text-white !transition-[background-color,translate,box-shadow,opacity] !duration-[250ms] !ease-out hover:-translate-y-1 hover:!bg-volt-deep hover:shadow-[0_22px_48px_-14px_rgba(11,11,11,0.45)] ${
        isNavigating ? "pointer-events-none opacity-70" : ""
      } ${className}`}
    >
      {isNavigating ? t.checkoutButton.navigating : label}
    </ButtonLink>
  );
}
