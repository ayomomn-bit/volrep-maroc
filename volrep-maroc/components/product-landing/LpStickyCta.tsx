"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useBuyQuantity } from "@/components/product-landing/buy-quantity";
import { directCheckoutHref } from "@/lib/backend/direct-checkout";

// Reference `.sticky-cta` — the mobile-only fixed bottom bar (price + CTA).
// Hidden ≥768px by product-landing.css; slides up once the visitor has
// scrolled past the fold.
//
// "Commander maintenant" here uses the SAME Direct Buy mechanism as the hero
// CTA (LpBuyBox): it navigates to /checkout?buy=<handle>&qty=<n> with the
// shared purchase quantity (useBuyQuantity). No cart mutation, no drawer, no
// #order scroll.
export function LpStickyCta({
  price,
  oldPrice,
  handle,
  label = "Commander maintenant",
}: {
  price: string;
  oldPrice: string | null;
  handle: string;
  label?: string;
}) {
  const router = useRouter();
  const { quantity } = useBuyQuantity();
  const [isNavigating, startNavigation] = useTransition();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const href = directCheckoutHref(handle, quantity);

  function goToDirectCheckout(event: React.MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab, etc.) use the real href.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (isNavigating) return;
    startNavigation(() => {
      router.push(href);
    });
  }

  return (
    <div className={`sticky-cta ${visible ? "visible" : ""}`}>
      <div className="sticky-price">
        <span className="sticky-new">{price}</span>
        {oldPrice && <span className="sticky-old">{oldPrice}</span>}
      </div>
      <a href={href} className="sticky-btn" onClick={goToDirectCheckout}>
        {label}
      </a>
    </div>
  );
}
