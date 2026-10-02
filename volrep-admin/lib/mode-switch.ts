// Pure eligibility check for the "variants → simple" product-mode switch,
// mirrored from the backend's switchProductMode (services/admin/products.ts,
// "variante implicite" architecture):
//   - 0 variants: ALLOWED — the backend creates a fresh Default Variant on
//     the fly (price unset, stock 0), so an admin never has to fake a
//     throwaway variant through the normal variant UI first.
//   - 1 variant: ALLOWED — its values are copied onto the product.
//   - 2+ variants: BLOCKED — the admin must resolve that explicitly (this
//     never picks/merges for them).
// ModeSwitch.tsx uses this to disable the action and explain why, instead
// of letting the admin hit the 409 blind. The backend remains the
// authority — this never blocks a request that would actually succeed, and
// a race (e.g. another variant added by someone else) still surfaces as a
// 409 shown inline.
export type ModeSwitchBlockedReason = "multiple" | null;

export function switchToSimpleBlockedReason(variantCount: number): ModeSwitchBlockedReason {
  return variantCount > 1 ? "multiple" : null;
}
