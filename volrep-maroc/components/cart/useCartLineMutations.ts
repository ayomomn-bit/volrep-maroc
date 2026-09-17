"use client";

import { useState, useTransition } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { removeCartLineAction, updateCartLineAction } from "@/lib/backend/cart-actions";

// Shared by CartLineItem (the /cart page) and CartDrawerLineItem (the
// header drawer) so both surfaces mutate the one real Shopify cart through
// the same pending/error/setCart plumbing instead of each reimplementing it.
export function useCartLineMutations(lineId: string) {
  const { setCart } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateQuantity(quantity: number) {
    setError(null);
    startTransition(async () => {
      const result = await updateCartLineAction(lineId, quantity);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCart(result.cart);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeCartLineAction(lineId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCart(result.cart);
    });
  }

  return { isPending, error, updateQuantity, remove };
}
