"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { addToCartAction } from "@/lib/backend/cart-actions";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { useBuyQuantity } from "@/components/product-landing/buy-quantity";
import { directCheckoutHref } from "@/lib/backend/direct-checkout";
import type { ShopifyProduct } from "@/lib/backend/products";
import { t } from "@/lib/i18n";

// The product page's purchase CTA layer. Two actions on one product with one
// purchase variable — quantity:
//
//   [ Commander maintenant ]  (primary)   → /checkout?buy=<handle>&qty=<n>
//   [ Ajouter au panier ]     (secondary) → EXISTING cart + EXISTING drawer
//
// No new cart, checkout or order code.
//   - "Ajouter au panier" = the exact addToCartAction → setCart → openDrawer()
//     flow the (now-orphaned) components/product/AddToCart.tsx already used.
//   - "Commander maintenant" navigates straight to /checkout in direct mode.
//     It carries only a product handle + quantity in the URL — no cart, no
//     cookie, nothing written to `volrep_cart_id`. /checkout resolves the
//     product server-side (lib/backend/direct-checkout.ts) and the order is
//     placed via the shared placeCodOrder() with a fresh single-use cart.

const SUCCESS_DISPLAY_MS = 1800;

export function LpBuyBox({
  product,
  orderNowLabel,
}: {
  product: ShopifyProduct;
  orderNowLabel: ReactNode;
}) {
  const router = useRouter();
  const { setCart, openDrawer } = useCart();
  const { quantity, setQuantity } = useBuyQuantity();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNavigation] = useTransition();
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Single-variant product: the only variant is always variants[0].
  const variant = product.variants[0] ?? null;
  const variantId = variant?.id ?? "";
  const available = (variant?.availableForSale ?? product.availableForSale) && Boolean(variantId);

  function handleAddToCart() {
    if (isPending || !variantId) return;

    setError(null);
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);

    startTransition(async () => {
      const result = await addToCartAction(variantId, quantity);

      if (!result.success) {
        setStatus("error");
        setError(result.error);
        return;
      }

      setCart(result.cart);
      setStatus("added");
      successTimeoutRef.current = setTimeout(() => setStatus("idle"), SUCCESS_DISPLAY_MS);
      openDrawer();
    });
  }

  function handleOrderNow() {
    if (!variantId || isNavigating) return;
    // Direct checkout: product handle + quantity only, in the URL. No cart
    // mutation, no drawer, no #order scroll. Same builder the mobile sticky
    // CTA uses.
    startNavigation(() => {
      router.push(directCheckoutHref(product.handle, quantity));
    });
  }

  const addToCartLabel = !available
    ? t.product.addToCart.soldOut
    : isPending
      ? t.product.addToCart.adding
      : status === "added"
        ? t.product.addToCart.added
        : t.product.addToCart.idle;

  return (
    <div className="lp-buy">
      {/* Secondary purchase row: fixed-width qty stepper + "Ajouter au
          panier" flexing to fill the rest. QuantitySelector already carries
          its own role="group" aria-label (t.product.quantity.group), so no
          separate visible label is needed here. */}
      <div className="lp-buy-secondary-row">
        <QuantitySelector quantity={quantity} onChange={setQuantity} disabled={isPending || isNavigating} />
        <button
          type="button"
          className="lp-buy-btn lp-buy-btn--secondary"
          onClick={handleAddToCart}
          disabled={!available || isPending}
          aria-live="polite"
        >
          {addToCartLabel}
        </button>
      </div>

      {/* "Commander maintenant" is NOT availability-gated — it stays the
          direct-buy entry point exactly as the previous <a class="main-cta">
          anchor did (which had no stock awareness). Only a genuinely
          variant-less product disables it. Stock is enforced server-side by
          the direct-checkout action / backend. */}
      <button
        type="button"
        className="lp-buy-btn lp-buy-btn--primary"
        onClick={handleOrderNow}
        disabled={!variantId || isNavigating}
      >
        {orderNowLabel}
      </button>

      {error && (
        <p className="form-error" role="alert" style={{ textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
