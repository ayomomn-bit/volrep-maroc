"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { CartDrawerLineItem } from "@/components/cart/CartDrawerLineItem";
import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { formatMoney } from "@/lib/backend/money";
import { t } from "@/lib/i18n";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// Global drawer for the "Add to Cart just succeeded" confirmation and for
// the header cart icon — mounted once in the root layout, driven entirely
// by CartProvider's context (the same cart state the /cart page and
// AddToCart already read/write). No cart data of its own.
export function CartDrawer() {
  const { cart, isDrawerOpen, closeDrawer } = useCart();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close on navigation. "Checkout →" links to this app's own /checkout
  // (a client-side transition), unlike the old Shopify flow which was a
  // full-page redirect that tore the drawer down for free — without this,
  // the drawer and its backdrop stay mounted on top of the destination page.
  useEffect(() => {
    closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen, closeDrawer]);

  const lines = cart?.lines ?? [];
  const isEmpty = !cart || lines.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={`fixed inset-0 z-[60] bg-ink/40 transition-opacity duration-300 ease-out ${
          isDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.cart.drawerTitle}
        className={`fixed inset-y-0 right-0 z-[60] flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-[420px] ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-black/[0.06] px-5 sm:px-6">
          <h2 className="text-lg font-bold uppercase tracking-tight text-ink">{t.cart.drawerTitle}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label={t.cart.closeCart}
            tabIndex={isDrawerOpen ? 0 : -1}
            className="flex h-11 w-11 items-center justify-center rounded-sm text-ink transition-colors duration-200 ease-out hover:text-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2"
          >
            <CloseIcon />
          </button>
        </div>

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="text-2xl uppercase leading-tight tracking-[-0.02em] text-foreground">{t.cart.emptyTitle}</p>
            <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
              {t.cart.emptyDrawerBody}
            </p>
            <Link
              href="/products/volrep-prm"
              onClick={closeDrawer}
              tabIndex={isDrawerOpen ? 0 : -1}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-volt px-6 text-sm font-medium tracking-wide text-white transition-colors duration-200 ease-out hover:bg-volt-deep"
            >
              {t.cart.shopProductCta}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 sm:px-6">
              <div className="flex flex-col divide-y divide-black/[0.06]">
                {lines.map((line) => (
                  <CartDrawerLineItem key={line.id} line={line} />
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-black/[0.06] px-5 py-6 sm:px-6">
              <div className="flex items-center justify-between text-base">
                <span className="text-slate">{t.cart.subtotal}</span>
                <span className="font-semibold text-ink">{formatMoney(cart.cost.subtotalAmount)}</span>
              </div>

              <CheckoutButton label={t.cart.checkoutArrow} className="mt-4 h-14 w-full" />

              <Link
                href="/cart"
                onClick={closeDrawer}
                tabIndex={isDrawerOpen ? 0 : -1}
                className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl border border-ink/15 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:border-ink/40"
              >
                {t.cart.viewCart}
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
