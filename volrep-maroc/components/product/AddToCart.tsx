"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import { addToCartAction } from "@/lib/backend/cart-actions";
import { t } from "@/lib/i18n";

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      <path d="M3 4h2l1.4 11.2a1.5 1.5 0 0 0 1.5 1.3h9.2a1.5 1.5 0 0 0 1.48-1.24L20 8H6" />
      <circle cx="10" cy="20.5" r="1.25" />
      <circle cx="17" cy="20.5" r="1.25" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// "Added" is shown for this long before the button reverts to its resting
// state — long enough to register as confirmation, short enough that a
// customer adding a second item isn't stuck waiting on it.
const SUCCESS_DISPLAY_MS = 1800;

export function AddToCart({
  variantId,
  quantity,
  available,
}: {
  variantId: string;
  quantity: number;
  available: boolean;
}) {
  const { setCart, openDrawer } = useCart();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  function handleAddToCart() {
    // isPending already guards against re-entrant clicks (the transition
    // is in flight until the action resolves), but this is an explicit,
    // synchronous belt-and-suspenders check against double submissions.
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
      setStatus("success");
      successTimeoutRef.current = setTimeout(() => setStatus("idle"), SUCCESS_DISPLAY_MS);
      openDrawer();
    });
  }

  const isAdded = status === "success";

  return (
    <div className="flex-1">
      <Button
        variant="primary"
        size="lg"
        disabled={!available || isPending}
        onClick={handleAddToCart}
        aria-live="polite"
        // Button's shared "primary" variant is bg-ink — left untouched since
        // other call sites (e.g. the homepage Hero CTA) should stay black.
        // This is the one deliberate exception: the storefront's single
        // highest-intent purchase action gets the brand's full-strength blue
        // (see globals.css's brand-token comment), with a flat --volt-deep
        // hover — no gradient — for a solid pressed-state feel. !-prefixed
        // because Button's own bg-ink/hover:opacity-90 share the same
        // specificity and would otherwise win the cascade tie (same reason
        // the transition/duration overrides below already needed it).
        className="h-16 w-full rounded-2xl !bg-volt text-base tracking-wide !text-white !transition-[background-color,translate,box-shadow,opacity] !duration-[250ms] !ease-out hover:-translate-y-1 hover:!bg-volt-deep hover:shadow-[0_22px_48px_-14px_rgba(11,11,11,0.45)] disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {available && (isAdded ? <CheckIcon /> : <CartIcon />)}
        {!available
          ? t.product.addToCart.soldOut
          : isPending
            ? t.product.addToCart.adding
            : isAdded
              ? t.product.addToCart.added
              : t.product.addToCart.idle}
      </Button>

      {error && (
        <p role="alert" className="mt-2.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
