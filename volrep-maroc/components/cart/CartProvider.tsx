"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { getCartAction } from "@/lib/backend/cart-actions";
import type { Cart } from "@/lib/backend/cart";

type CartContextValue = {
  cart: Cart | null;
  cartCount: number;
  isLoading: boolean;
  setCart: (cart: Cart | null) => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// Root-level source of truth for cart UI state (Header's badge, the cart
// page's line list) — but never the source of truth for the cart itself,
// which stays Shopify. Every value here is either read straight from a
// Server Action's return value (addToCartAction/updateCartLineAction/
// removeCartLineAction) or, on mount, rehydrated from Shopify via
// getCartAction() so a hard refresh doesn't lose the badge count even
// though this Provider's own state resets to null.
//
// Deliberately NOT wired up in the root layout via a server-side cart
// read: this Provider (and the layout wrapping it) has no dynamic-API
// dependency of its own, so the homepage/product pages it wraps keep
// their existing ISR (`revalidate = 300`) instead of the whole app being
// forced into per-request dynamic rendering just to know the cart count.
// The tradeoff is a brief "0" flash on first paint until this effect
// resolves, which is standard for client-hydrated cart badges.
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const initialCart = await getCartAction();
      setCart(initialCart);
    });
  }, []);

  const value: CartContextValue = {
    cart,
    cartCount: cart?.totalQuantity ?? 0,
    isLoading: isPending,
    setCart,
    isDrawerOpen,
    openDrawer: () => setIsDrawerOpen(true),
    closeDrawer: () => setIsDrawerOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
