"use server";

import { BackendError } from "@/lib/backend/client";
import { isValidCodCustomer, normalizeCodCustomer, placeCodOrder } from "@/lib/backend/cod-order";
import { clientForwardedFor } from "@/lib/backend/request-ip";
import type { PlacedOrder } from "@/lib/backend/checkout-actions";

// Server Action powering the product landing page's inline Cash-on-Delivery
// order form (components/product-landing/LpOrderForm.tsx).
//
// It reproduces the reference landing page's "fill the form, we call you to
// confirm" flow WITHOUT introducing any new backend contract: via
// placeCodOrder() (lib/backend/cod-order.ts) it drives the exact same two
// endpoints the normal cart → /checkout path already uses — POST
// /api/cart/lines then POST /api/checkout/session.
//
// Differences from the standard flow, all deliberate and all now shared with
// the "Commander maintenant" direct-checkout action:
//  - A brand-new cart is minted (no `cartId`) and its id is never written to
//    the `volrep_cart_id` cookie. This order is standalone — it must not
//    merge into, consume, or disturb the visitor's shopping-cart drawer.
//  - The recipient NAME, which the checkout API has no field for, is carried
//    in `shippingAddress.line2` ("Destinataire : …") — see
//    RECIPIENT_LINE2_PREFIX in cod-order.ts.
//  - `email` is required by POST /api/checkout/session; the form collects it.

export type InlineOrderInput = {
  variantId: string;
  quantity: number;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
};

export type InlineOrderResult = { success: true; order: PlacedOrder } | { success: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue lors de l’enregistrement de votre commande. Veuillez réessayer.";
const INVALID_INPUT = "Merci de vérifier les informations saisies.";

function friendlyError(error: unknown): string {
  if (error instanceof BackendError) {
    if (error.code === "OUT_OF_STOCK") return "Le stock disponible pour cet article est insuffisant.";
    if (error.code === "VALIDATION_ERROR" || error.status >= 500) {
      console.error(`Volrep backend inline-order error [${error.code}]:`, error.message);
      return GENERIC_ERROR;
    }
    return error.message;
  }
  console.error("Volrep backend inline-order request failed:", error);
  return GENERIC_ERROR;
}

export async function submitInlineOrderAction(input: InlineOrderInput): Promise<InlineOrderResult> {
  const customer = normalizeCodCustomer(input);
  const quantity = Number(input.quantity);

  // Unchanged from the original: variant id must be present, quantity 1–10,
  // and the shared customer-field rule (name ≥ 2, city ≥ 2, address ≥ 4,
  // valid email, valid Moroccan phone).
  if (
    !input.variantId ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 10 ||
    !isValidCodCustomer(customer)
  ) {
    return { success: false, error: INVALID_INPUT };
  }

  try {
    const order = await placeCodOrder({
      variantId: input.variantId,
      quantity,
      customer,
      forwardedFor: await clientForwardedFor(),
    });
    return { success: true, order };
  } catch (error) {
    return { success: false, error: friendlyError(error) };
  }
}
