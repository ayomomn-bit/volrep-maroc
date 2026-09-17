"use server";

import { cookies } from "next/headers";
import { backendFetch, BackendError } from "@/lib/backend/client";
import { CART_COOKIE_NAME } from "@/lib/backend/cart";
import { buildCodCheckoutBody, composeFullName, isCodCustomerValid, type CodCustomerFields } from "@/lib/backend/cod-customer";
import { clientForwardedFor } from "@/lib/backend/request-ip";
import type { ShopifyMoney } from "@/lib/backend/products";

// The five customer fields the Moroccan COD checkout collects. No email,
// postal code, country or company — see lib/backend/cod-customer.ts.
export type CheckoutInput = CodCustomerFields;

// V1 is Cash on Delivery only — this is what the backend actually returns
// from POST /api/checkout/session today. No redirectUrl exists in this
// response at all; a future card provider would add one alongside `order`.
export type PlacedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  subtotalAmount: ShopifyMoney;
  shippingAmount: ShopifyMoney;
  totalAmount: ShopifyMoney;
  currency: string;
};

export type CheckoutActionResult = { success: true; order: PlacedOrder } | { success: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue lors de l’enregistrement de votre commande. Veuillez réessayer.";
const EMPTY_CART_ERROR = "Votre panier est vide.";
const INVALID_INPUT = "Merci de vérifier les informations saisies.";

function friendlyCheckoutError(error: unknown): string {
  if (error instanceof BackendError) {
    if (error.code === "VALIDATION_ERROR" || error.status >= 500) {
      console.error(`Volrep backend checkout error [${error.code}]:`, error.message);
      return GENERIC_ERROR;
    }
    return error.message;
  }
  console.error("Volrep backend checkout request failed:", error);
  return GENERIC_ERROR;
}

// Server Action: the browser never sees the internal API key or talks to
// the backend directly — it submits this form, this action reads the cart id
// from the httpOnly cookie, and this action alone calls the backend. Same
// COD order contract as before; only the client fields changed (5 fields,
// no email — email is synthesized in buildCodCheckoutBody).
export async function submitCheckoutAction(input: CheckoutInput): Promise<CheckoutActionResult> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    return { success: false, error: EMPTY_CART_ERROR };
  }

  if (!isCodCustomerValid(input)) {
    return { success: false, error: INVALID_INPUT };
  }

  try {
    const { order } = await backendFetch<{ order: PlacedOrder }>("/api/checkout/session", {
      method: "POST",
      forwardedFor: await clientForwardedFor(),
      body: buildCodCheckoutBody({
        cartId,
        fullName: composeFullName(input.firstName, input.lastName),
        email: null,
        phone: input.phone,
        city: input.city,
        address: input.address,
      }),
    });

    // The cart is single-use and the backend has already marked it
    // 'converted' — clearing the cookie here means a refresh right after
    // checkout never even attempts to resolve a dead cart id.
    cookieStore.delete(CART_COOKIE_NAME);

    return { success: true, order };
  } catch (error) {
    return { success: false, error: friendlyCheckoutError(error) };
  }
}
