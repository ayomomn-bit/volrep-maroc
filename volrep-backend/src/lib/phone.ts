// Canonical form of a customer phone number, used ONLY as the lookup key
// for the per-phone COD abuse guard (src/lib/abuse-guard.ts). It is never
// persisted — `orders.phone` keeps the exact string the customer typed.
//
// The storefront only ever submits Moroccan mobile numbers, in one of three
// shapes (see the frontend's MOROCCAN_PHONE_PATTERN):
//   local:        0612345678   / 0712345678
//   E.164:        +212612345678
//   00-prefixed:  00212612345678
// all of which denote the same subscriber and must collapse to one key.
// Separators (spaces, dashes, dots, parentheses, a leading "+") are ignored.
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2); // 00212… → 212…
  } else if (digits.startsWith("0")) {
    digits = `212${digits.slice(1)}`; // 06…/07… (national) → 2126…/2127…
  }

  return `+${digits}`;
}
