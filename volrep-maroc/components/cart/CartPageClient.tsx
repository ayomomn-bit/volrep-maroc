"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { EmptyCart } from "@/components/cart/EmptyCart";
import type { Cart } from "@/lib/backend/cart";
import { t } from "@/lib/i18n";

export function CartPageClient({ initialCart }: { initialCart: Cart | null }) {
  const { cart, setCart } = useCart();

  // Seed the shared cart context with this page's own server-verified read
  // on mount. Without this, a direct/deep-linked visit to /cart (or a hard
  // refresh here) would show the Header badge as empty until
  // CartProvider's separate rehydrate fetch resolves on its own.
  useEffect(() => {
    setCart(initialCart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCart = cart ?? initialCart;

  if (!activeCart || activeCart.lines.length === 0) {
    return <EmptyCart />;
  }

  return (
    <>
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
        VOLREP<span aria-hidden="true">™</span> / {t.cart.eyebrow}
      </p>

      <h1 className="mt-5 text-4xl uppercase leading-[0.95] tracking-[-0.02em] text-foreground sm:text-5xl">
        {t.cart.pageTitle}
      </h1>

      <div className="mt-10 grid gap-12 sm:mt-12 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-16">
        <div className="flex flex-col divide-y divide-black/[0.06]">
          {activeCart.lines.map((line) => (
            <CartLineItem key={line.id} line={line} />
          ))}
        </div>

        <OrderSummary cart={activeCart} />
      </div>
    </>
  );
}
