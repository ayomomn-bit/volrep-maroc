// ---------------------------------------------------------------------------
// Cash-on-Delivery customer data — shared, framework-agnostic (no
// "server-only"), so the same rules run in the client form (CheckoutForm)
// and in the Server Actions.
//
// The Moroccan COD checkout collects exactly five customer fields:
//   Prénom · Nom · Numéro de téléphone · Ville · Adresse complète
// No email, no postal code, no country, no company. The customer is never
// asked for an email.
//
// The backend checkout contract (POST /api/checkout/session) still requires
// an `email` (orders.email is NOT NULL). Since the customer no longer
// provides one, codOrderEmail() synthesizes a stable, non-deliverable
// placeholder from the phone number — used ONLY to satisfy that contract,
// never shown to the customer.
// ---------------------------------------------------------------------------

// Moroccan mobile number: 06/07 local, or +212 / 00212 international.
export const MOROCCAN_PHONE_PATTERN = /^(?:0|\+212|00212)[67]\d{8}$/;

// The checkout API has no recipient-name field — the composed "Prénom Nom"
// rides in shippingAddress.line2 with this prefix so fulfilment sees who to
// deliver to. One definition, here.
export const RECIPIENT_LINE2_PREFIX = "Destinataire : ";

export type CodCustomerFields = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  address: string;
};

export type CodCustomerFieldIssue = "required" | "invalid";
export type CodCustomerErrors = Partial<Record<keyof CodCustomerFields, CodCustomerFieldIssue>>;

export function validateCodCustomerFields(fields: CodCustomerFields): CodCustomerErrors {
  const errors: CodCustomerErrors = {};

  if (fields.firstName.trim().length < 2) errors.firstName = "required";
  if (fields.lastName.trim().length < 2) errors.lastName = "required";

  const phone = fields.phone.replace(/\s/g, "");
  if (!phone) errors.phone = "required";
  else if (!MOROCCAN_PHONE_PATTERN.test(phone)) errors.phone = "invalid";

  if (fields.city.trim().length < 2) errors.city = "required";
  if (fields.address.trim().length < 4) errors.address = "required";

  return errors;
}

export function isCodCustomerValid(fields: CodCustomerFields): boolean {
  return Object.keys(validateCodCustomerFields(fields)).length === 0;
}

export function composeFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

// Stable per phone number, obviously non-deliverable. Not a customer-facing
// value — the customer never sees or types this.
export function codOrderEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `cod-${digits || "client"}@no-reply.volrep.ma`;
}

export type CodCheckoutBody = {
  cartId: string;
  email: string;
  phone: string;
  shippingAddress: { line1: string; line2: string; city: string; country: "MA" };
};

// Assembles the POST /api/checkout/session body from a resolved cart id and
// the COD customer. `email` is synthesized when not supplied (it never is,
// for the Moroccan checkout) — the backend order contract is unchanged.
export function buildCodCheckoutBody(params: {
  cartId: string;
  fullName: string;
  email: string | null;
  phone: string;
  city: string;
  address: string;
}): CodCheckoutBody {
  const phone = params.phone.trim();
  return {
    cartId: params.cartId,
    email: params.email?.trim() || codOrderEmail(phone),
    phone,
    shippingAddress: {
      line1: params.address.trim(),
      line2: `${RECIPIENT_LINE2_PREFIX}${params.fullName.trim()}`,
      city: params.city.trim(),
      country: "MA",
    },
  };
}
