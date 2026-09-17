"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import { addToCartAction } from "@/lib/backend/cart-actions";
import { t } from "@/lib/i18n";

// Outlined counterpart to AddToCart, same size and hover treatment. Now
// functional: adds the selected variant to the cart (same Server Action
// AddToCart uses) and, on success, navigates straight to /checkout —
// previously this was a stub with no cart/checkout architecture to wire
// into yet.
export function BuyNowButton({
  variantId,
  quantity,
  available,
}: {
  variantId: string;
  quantity: number;
  available: boolean;
}) {
  const router = useRouter();
  const { setCart } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleBuyNow() {
    if (isPending || !variantId) return;
    setError(null);

    startTransition(async () => {
      const result = await addToCartAction(variantId, quantity);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setCart(result.cart);
      router.push("/checkout");
    });
  }

  return (
    <div>
      <Button
        variant="secondary"
        size="lg"
        disabled={!available || isPending}
        onClick={handleBuyNow}
        className="h-16 w-full rounded-2xl border !border-ink bg-white text-base tracking-wide text-ink !transition-[translate,box-shadow,opacity,background-color,color] !duration-[250ms] !ease-out hover:-translate-y-1 hover:!bg-ink hover:!text-paper hover:shadow-[0_22px_48px_-14px_rgba(11,11,11,0.4)]"
      >
        {isPending ? t.product.buyNow.adding : t.product.buyNow.idle}
      </Button>

      {error && (
        <p role="alert" className="mt-2.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
