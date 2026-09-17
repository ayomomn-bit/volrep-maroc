import "server-only";

import { backendFetch } from "@/lib/backend/client";
import { buildCodCheckoutBody, MOROCCAN_PHONE_PATTERN } from "@/lib/backend/cod-customer";
import type { Cart } from "@/lib/backend/cart";
import type { PlacedOrder } from "@/lib/backend/checkout-actions";

// ---------------------------------------------------------------------------
// Shared Cash-on-Delivery order placement — the ONE place a standalone
// (cart-drawer-less) COD order is created. Used by:
//
//   - lib/backend/inline-order-actions.ts   (the inline "#order" form)
//   - lib/backend/direct-checkout-actions.ts ("Commander maintenant" flow)
//
// It drives the exact two endpoints the normal cart → /checkout path uses —
// POST /api/cart/lines then POST /api/checkout/session — with NO new backend
// contract. The single deliberate difference from the normal path: the cart
// minted here is standalone. No `cartId` is sent (the backend mints a fresh
// one), and its id is never written to the `volrep_cart_id` cookie.
//
// The COD order contract itself (totals, line items, payment method, status,
// stock) is owned entirely by the backend's createCodOrder() — this helper
// only assembles the request. Email is synthesized when absent — see
// lib/backend/cod-customer.ts codOrderEmail().
// ---------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CodCustomerInput = {
  fullName: string;
  // Optional: the Moroccan checkout no longer collects an email. The inline
  // form still passes one; when it's absent, placeCodOrder() synthesizes a
  // placeholder for the backend contract.
  email?: string;
  phone: string;
  city: string;
  address: string;
};

export type NormalizedCodCustomer = {
  fullName: string;
  email: string | null;
  phone: string;
  city: string;
  address: string;
};

export function normalizeCodCustomer(input: CodCustomerInput): NormalizedCodCustomer {
  return {
    fullName: input.fullName?.trim() ?? "",
    email: input.email?.trim() || null,
    phone: input.phone?.trim() ?? "",
    city: input.city?.trim() ?? "",
    address: input.address?.trim() ?? "",
  };
}

// The shared customer-field rule for the inline COD form. The email is only
// validated when the caller actually supplied one (the inline form does; the
// 5-field /checkout form does not — it has its own validator in cod-customer.ts).
export function isValidCodCustomer(customer: NormalizedCodCustomer): boolean {
  return (
    customer.fullName.length >= 2 &&
    customer.city.length >= 2 &&
    customer.address.length >= 4 &&
    (customer.email === null || EMAIL.test(customer.email)) &&
    MOROCCAN_PHONE_PATTERN.test(customer.phone.replace(/\s/g, ""))
  );
}

export type PlaceCodOrderInput = {
  variantId: string;
  quantity: number;
  customer: NormalizedCodCustomer;
  // Real shopper IP, forwarded to the backend's per-IP COD abuse guard.
  // Optional: when absent the backend keys on the socket address.
  forwardedFor?: string | null;
};

export async function placeCodOrder({ variantId, quantity, customer, forwardedFor }: PlaceCodOrderInput): Promise<PlacedOrder> {
  // 1. Fresh standalone cart — no `cartId` sent, and the returned id is
  //    deliberately discarded (never written to `volrep_cart_id`).
  const { cart } = await backendFetch<{ cart: Cart }>("/api/cart/lines", {
    method: "POST",
    body: { variantId, quantity },
    forwardedFor,
  });

  // 2. Place the COD order against that cart. Identical body shape to the
  //    normal /checkout path's submitCheckoutAction (buildCodCheckoutBody).
  const { order } = await backendFetch<{ order: PlacedOrder }>("/api/checkout/session", {
    method: "POST",
    forwardedFor,
    body: buildCodCheckoutBody({
      cartId: cart.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      address: customer.address,
    }),
  });

  return order;
}
