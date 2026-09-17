"use server";

import { BackendError } from "@/lib/backend/client";
import { getProduct } from "@/lib/backend/products";
import { placeCodOrder, type NormalizedCodCustomer } from "@/lib/backend/cod-order";
import { composeFullName, isCodCustomerValid, type CodCustomerFields } from "@/lib/backend/cod-customer";
import { MAX_DIRECT_QUANTITY } from "@/lib/backend/direct-checkout";
import { clientForwardedFor } from "@/lib/backend/request-ip";
import type { PlacedOrder } from "@/lib/backend/checkout-actions";

// Server Action for "Commander maintenant" → /checkout (direct mode).
//
// It reuses the SAME order path as everything else: placeCodOrder
// (POST /api/cart/lines → POST /api/checkout/session → backend
// createCodOrder). Specific to this flow: the product/variant/price is
// resolved SERVER-SIDE from a handle — the browser supplies a handle, a
// quantity and the five customer fields, nothing else. No email.
//
// It does NOT read or write the `volrep_cart_id` cookie, and never calls the
// normal cart's Server Actions — a visitor's shopping cart and drawer are
// untouched whether this succeeds, fails, or is abandoned.

export type DirectCheckoutInput = {
  handle: string;
  quantity: number;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  address: string;
};

export type DirectCheckoutResult =
  | { success: true; order: PlacedOrder }
  | { success: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue lors de l’enregistrement de votre commande. Veuillez réessayer.";
const INVALID_INPUT = "Merci de vérifier les informations saisies.";
const UNAVAILABLE = "Ce produit n’est pas disponible à la commande pour le moment.";
const OUT_OF_STOCK_ERROR = "Le stock disponible pour cet article est insuffisant.";

function friendlyError(error: unknown): string {
  if (error instanceof BackendError) {
    if (error.code === "OUT_OF_STOCK") return OUT_OF_STOCK_ERROR;
    if (error.code === "VALIDATION_ERROR" || error.status >= 500) {
      console.error(`Volrep backend direct-checkout error [${error.code}]:`, error.message);
      return GENERIC_ERROR;
    }
    return error.message;
  }
  console.error("Volrep backend direct-checkout request failed:", error);
  return GENERIC_ERROR;
}

export async function submitDirectCheckoutAction(input: DirectCheckoutInput): Promise<DirectCheckoutResult> {
  const quantity = Number(input.quantity);
  const fields: CodCustomerFields = {
    firstName: input.firstName ?? "",
    lastName: input.lastName ?? "",
    phone: input.phone ?? "",
    city: input.city ?? "",
    address: input.address ?? "",
  };

  if (
    !input.handle ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_DIRECT_QUANTITY ||
    !isCodCustomerValid(fields)
  ) {
    return { success: false, error: INVALID_INPUT };
  }

  // Resolve product + price server-side. The client never sends a variant id
  // or a price for this flow (security §12): only a handle, a quantity and
  // the customer fields, all re-validated here and by the backend.
  const product = await getProduct(input.handle);
  const variant = product?.variants[0] ?? null;
  if (!product || !variant) {
    return { success: false, error: UNAVAILABLE };
  }
  if (!(variant.availableForSale ?? product.availableForSale)) {
    return { success: false, error: OUT_OF_STOCK_ERROR };
  }

  const customer: NormalizedCodCustomer = {
    fullName: composeFullName(fields.firstName, fields.lastName),
    email: null, // the Moroccan COD checkout never collects an email
    phone: fields.phone.trim(),
    city: fields.city.trim(),
    address: fields.address.trim(),
  };

  try {
    const order = await placeCodOrder({
      variantId: variant.id,
      quantity,
      customer,
      forwardedFor: await clientForwardedFor(),
    });
    return { success: true, order };
  } catch (error) {
    return { success: false, error: friendlyError(error) };
  }
}
