"use server";

import { cookies } from "next/headers";
import { backendFetch, BackendError } from "@/lib/backend/client";
import { clientForwardedFor } from "@/lib/backend/request-ip";
import {
  CART_COOKIE_NAME,
  enrichCartWithProductImages,
  getCurrentCart,
  isValidCartId,
  type Cart,
} from "@/lib/backend/cart";

// Same lifetime as the backend's own cart expiry (Architecture §06) — the
// cookie just needs to comfortably outlast the cart itself.
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const GENERIC_ERROR = "Une erreur est survenue. Veuillez réessayer.";
const ADD_ERROR = "Impossible d’ajouter cet article pour le moment. Veuillez réessayer.";
const OUT_OF_STOCK_ERROR = "Le stock disponible pour cet article est insuffisant.";

export type CartActionResult = { success: true; cart: Cart } | { success: false; error: string };

async function persistCartId(cartId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE_NAME, cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

// Every backend error is collapsed to a short, customer-facing message
// here — the boundary that keeps raw backend error text (or worse, a
// stack trace) from ever reaching the UI, same discipline the old
// Shopify-era cart.ts's resolveMutation() applied.
function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof BackendError) {
    if (error.code === "OUT_OF_STOCK") return OUT_OF_STOCK_ERROR;
    console.error(`Volrep backend cart error [${error.code}]:`, error.message);
    return fallback;
  }
  console.error("Volrep backend cart request failed:", error);
  return fallback;
}

// Read-only — lets Client Components (CartProvider's mount-time rehydrate)
// resolve the real cart without ever touching the internal API key
// themselves; only this action's return value crosses the server/client
// boundary.
export async function getCartAction(): Promise<Cart | null> {
  return getCurrentCart();
}

export async function addToCartAction(variantId: string, quantity: number): Promise<CartActionResult> {
  if (!variantId || !Number.isInteger(quantity) || quantity < 1) {
    return { success: false, error: ADD_ERROR };
  }

  const cookieStore = await cookies();
  const cookieCartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  // Only forward a well-formed cart id. The backend creates a fresh cart
  // automatically when cartId is absent, expired, or already converted
  // (Architecture §06) — but a malformed value (e.g. a leftover Shopify
  // cart GID under this same cookie name) fails the backend's `uuid()`
  // schema with a 400 before that fallback ever runs. Dropping it here
  // lets the fresh-cart path take over, and persistCartId() below then
  // overwrites the stale cookie with the new id.
  const existingCartId = isValidCartId(cookieCartId) ? cookieCartId : undefined;

  try {
    const { cart } = await backendFetch<{ cart: Cart }>("/api/cart/lines", {
      method: "POST",
      forwardedFor: await clientForwardedFor(),
      body: { ...(existingCartId ? { cartId: existingCartId } : {}), variantId, quantity },
    });
    await persistCartId(cart.id);
    return { success: true, cart: await enrichCartWithProductImages(cart) };
  } catch (error) {
    return { success: false, error: friendlyMessage(error, ADD_ERROR) };
  }
}

export async function updateCartLineAction(lineId: string, quantity: number): Promise<CartActionResult> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (!cartId) return { success: false, error: GENERIC_ERROR };

  try {
    const { cart } = await backendFetch<{ cart: Cart }>(`/api/cart/lines/${encodeURIComponent(lineId)}`, {
      method: "PATCH",
      forwardedFor: await clientForwardedFor(),
      body: { cartId, quantity },
    });
    return { success: true, cart: await enrichCartWithProductImages(cart) };
  } catch (error) {
    return { success: false, error: friendlyMessage(error, GENERIC_ERROR) };
  }
}

export async function removeCartLineAction(lineId: string): Promise<CartActionResult> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (!cartId) return { success: false, error: GENERIC_ERROR };

  try {
    const { cart } = await backendFetch<{ cart: Cart }>(`/api/cart/lines/${encodeURIComponent(lineId)}`, {
      method: "DELETE",
      forwardedFor: await clientForwardedFor(),
      query: { cartId },
    });
    return { success: true, cart: await enrichCartWithProductImages(cart) };
  } catch (error) {
    return { success: false, error: friendlyMessage(error, GENERIC_ERROR) };
  }
}
