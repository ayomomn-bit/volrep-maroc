import type { LandingPageBinding, LandingPageRole } from "@/lib/types";

// Pure view-logic for the Pages marketing tab. The backend already computes
// `verified`, `previewUrl` and `editorUrl`; these helpers just express the
// UI rules (§5–§8 of the Lirya V1 spec) in one testable place.

export function canPreview(b: LandingPageBinding): boolean {
  return b.cachedStatus === "published" && !!b.previewUrl;
}

export function isVerified(b: LandingPageBinding): boolean {
  return b.verified === true;
}

export function editorLinkVisible(b: LandingPageBinding): boolean {
  return !!b.editorUrl;
}

// Which status/sync banner (if any) the card shows, in priority order:
// a sync failure first, then a non-published status.
export type LandingBannerKind = "syncError" | "offline" | "draft" | null;

export function bannerKind(b: LandingPageBinding): LandingBannerKind {
  if (b.syncError) return "syncError";
  if (b.cachedStatus === "hidden") return "offline";
  if (b.cachedStatus === "draft") return "draft";
  return null;
}

// The binding roles the admin UI offers, in display order. A product holds
// at most one page per role (enforced server-side).
export const LANDING_PAGE_ROLES: LandingPageRole[] = ["primary", "campaign", "ab_variant", "locale"];

// Roles still free to assign, given the bindings a product already has.
export function availableRoles(bindings: LandingPageBinding[]): LandingPageRole[] {
  const taken = new Set(bindings.map((b) => b.role));
  return LANDING_PAGE_ROLES.filter((r) => !taken.has(r));
}

// Whether the "Associer une (autre) page" affordance should be enabled:
// Lirya must be configured AND at least one role must still be free.
// (Associating needs a live Lirya call; a cached binding can be viewed
// read-only when Lirya is down, but no new binding can be created.)
export function canAssociateMore(liryaConfigured: boolean, bindings: LandingPageBinding[]): boolean {
  return liryaConfigured && availableRoles(bindings).length > 0;
}
