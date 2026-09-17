import type { Role } from "@/lib/types";

// Capabilities the UI uses to show/hide controls. This is a UX affordance
// ONLY — the backend re-checks every one of these on the server and is the
// sole source of truth. Hiding a button here never grants or withholds
// permission.
export type Capability =
  | "product.create"
  | "product.setStatus" // publish / unpublish / archive
  | "shipping.write"
  | "settings.write" // store identity — storefront-facing config
  | "integrations.test"; // run an outbound connection test

const OWNER_ONLY: Capability[] = [
  "product.create",
  "product.setStatus",
  "shipping.write",
  "settings.write",
  "integrations.test",
];

export function can(role: Role | undefined, capability: Capability): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  return !OWNER_ONLY.includes(capability);
}
