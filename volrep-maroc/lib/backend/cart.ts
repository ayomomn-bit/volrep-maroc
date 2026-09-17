import { cookies } from "next/headers";
import { backendFetch } from "@/lib/backend/client";
import { getProduct } from "@/lib/backend/products";
import type { ShopifyImage, ShopifyMoney, ShopifySelectedOption } from "@/lib/backend/products";

// Name of the cookie that persists the cart id across requests — shared
// between this file's getCurrentCart() (reads it) and
// cart-actions.ts's Server Actions (write it after a mutation). Next.js
// keeps owning this cookie exactly as before; only what's behind the id
// changed (Architecture §01/§06).
export const CART_COOKIE_NAME = "volrep_cart_id";

// The backend cart id is a UUID (POST /api/cart/lines and GET /api/cart
// both validate `cartId` as `z.string().uuid()` and reject anything else
// with a 400 before any cart logic runs). The cookie name is unchanged
// from the Shopify era, when it held a Shopify cart GID
// ("gid://shopify/Cart/..."), so a browser that used the site before this
// migration still carries a non-UUID value here. Treat any such value as
// "no cart" so the backend mints a fresh one instead of 400ing — matching
// how an absent cookie is already handled.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidCartId(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type CartLineMerchandise = {
  id: string;
  title: string;
  selectedOptions: ShopifySelectedOption[];
  image: ShopifyImage | null;
  price: ShopifyMoney;
  product: {
    title: string;
    handle: string;
  };
};

export type CartLine = {
  id: string;
  quantity: number;
  cost: {
    totalAmount: ShopifyMoney;
  };
  merchandise: CartLineMerchandise;
};

// No `checkoutUrl` — unlike Shopify's Cart API, there is nothing to
// redirect to for a Cash on Delivery order. CheckoutButton now links to
// this app's own /checkout page instead of a per-cart URL.
export type Cart = {
  id: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: ShopifyMoney;
    totalAmount: ShopifyMoney;
  };
  lines: CartLine[];
};

// The backend cart read model only carries a line's image when the *variant*
// has one (product_variants.image_id — see volrep-backend's
// services/cart.ts loadCartLineRows). VOLREP's product keeps its imagery at
// the product level (the gallery) and its variant has no image, so cart
// lines arrive with `merchandise.image === null` and every cart surface
// (drawer, /cart, checkout summary) shows a blank thumbnail.
//
// Backfill each imageless line from the SAME image the product page renders:
// getProduct(handle).featuredImage ?? images[0]. No new image source, no
// backend change. getProduct is ISR-cached (revalidate 300) and there is one
// product, so this is a single cached lookup per cart resolve.
export async function enrichCartWithProductImages(cart: Cart): Promise<Cart> {
  const handles = Array.from(
    new Set(
      cart.lines.filter((line) => !line.merchandise.image).map((line) => line.merchandise.product.handle),
    ),
  );
  if (handles.length === 0) return cart;

  const products = await Promise.all(handles.map((handle) => getProduct(handle)));
  const imageByHandle = new Map<string, ShopifyImage | null>();
  handles.forEach((handle, index) => {
    const product = products[index];
    imageByHandle.set(handle, product ? product.featuredImage ?? product.images[0] ?? null : null);
  });

  return {
    ...cart,
    lines: cart.lines.map((line) => {
      if (line.merchandise.image) return line;
      const fallback = imageByHandle.get(line.merchandise.product.handle) ?? null;
      if (!fallback) return line; // keep null — the components' graceful empty state
      return { ...line, merchandise: { ...line.merchandise, image: fallback } };
    }),
  };
}

// Server-only: resolves the cart persisted in the request's cookies. A
// missing cookie (first-time visitor) and an expired/converted cart id are
// both treated as "no cart" rather than an error, matching the backend's
// own GET /api/cart contract.
export async function getCurrentCart(): Promise<Cart | null> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (!isValidCartId(cartId)) return null;

  try {
    const { cart } = await backendFetch<{ cart: Cart | null }>("/api/cart", {
      query: { cartId },
      cache: "no-store",
    });
    return cart ? enrichCartWithProductImages(cart) : null;
  } catch (error) {
    console.error("Volrep backend getCurrentCart error:", error);
    return null;
  }
}
