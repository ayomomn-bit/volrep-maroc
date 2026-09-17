"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { OrderConfirmation } from "@/components/checkout/OrderConfirmation";
import type { Cart } from "@/lib/backend/cart";
import type { PlacedOrder } from "@/lib/backend/checkout-actions";
import type { DirectBuyContext } from "@/lib/backend/direct-checkout";
import { t } from "@/lib/i18n";

// Same seed-the-shared-context-on-mount pattern as CartPageClient.tsx —
// without it, a direct visit to /checkout would show the Header badge
// out of sync with this page's own server-verified cart read until
// CartProvider's separate rehydrate fetch resolves on its own.
//
// `directBuy` (from `/checkout?buy=…&qty=…`, "Commander maintenant") is a
// standalone purchase: the persistent cart is neither read nor cleared in
// that mode, so a visitor's shopping cart survives a direct order intact.
export function CheckoutPageClient({
  initialCart,
  directBuy,
}: {
  initialCart: Cart | null;
  directBuy?: DirectBuyContext | null;
}) {
  const { cart, setCart } = useCart();
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    // Direct mode never touches the cart context — leave whatever the
    // visitor already has alone.
    if (!directBuy) setCart(initialCart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (placedOrder) {
    return <OrderConfirmation order={placedOrder} />;
  }

  const header = (
    <>
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
        VOLREP<span aria-hidden="true">™</span> / {t.checkout.eyebrow}
      </p>

      <h1 className="mt-5 text-4xl uppercase leading-[0.95] tracking-[-0.02em] text-foreground sm:text-5xl">
        {t.checkout.title}
      </h1>
    </>
  );

  if (directBuy) {
    return (
      <>
        {header}
        <div className="mt-10 grid gap-12 sm:mt-12 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-16">
          <CheckoutForm
            mode="direct"
            directHandle={directBuy.handle}
            directQuantity={directBuy.quantity}
            onSuccess={setPlacedOrder}
          />
          <CheckoutSummary
            directLine={{
              title: directBuy.title,
              image: directBuy.image,
              unitPrice: directBuy.unitPrice,
              quantity: directBuy.quantity,
            }}
          />
        </div>
      </>
    );
  }

  const activeCart = cart ?? initialCart;

  if (!activeCart || activeCart.lines.length === 0) {
    return <EmptyCart />;
  }

  function handleSuccess(order: PlacedOrder) {
    // The backend already marked the cart converted; this clears the
    // client-side badge/drawer state to match immediately, rather than
    // waiting for the next rehydrate.
    setCart(null);
    setPlacedOrder(order);
  }

  return (
    <>
      {header}

      <div className="mt-10 grid gap-12 sm:mt-12 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-16">
        <CheckoutForm onSuccess={handleSuccess} />
        <CheckoutSummary cart={activeCart} />
      </div>
    </>
  );
}
