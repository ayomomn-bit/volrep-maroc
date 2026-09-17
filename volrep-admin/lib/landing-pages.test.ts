import { describe, expect, it } from "vitest";
import type { LandingPageBinding } from "@/lib/types";
import {
  LANDING_PAGE_ROLES,
  availableRoles,
  bannerKind,
  canAssociateMore,
  canPreview,
  editorLinkVisible,
  isVerified,
} from "@/lib/landing-pages";
import { t, liryaStatusLabel, liryaSyncErrorLabel, liryaRoleLabel } from "@/lib/i18n";

const base: LandingPageBinding = {
  id: "b1",
  liryaPageId: "pg_1",
  role: "primary",
  cachedStatus: "published",
  name: "Recovery",
  slug: "recovery",
  template: "classic",
  version: "v1",
  publicUrl: "https://lirya.test/p/recovery",
  previewUrl: "https://lirya.test/p/recovery",
  editorUrl: "https://lirya.test/editor.html?slug=recovery",
  verified: true,
  externalRefProductId: "prod-1",
  syncError: null,
  lastSyncedAt: "2026-08-01T00:00:00Z",
  lastCheckedAt: "2026-08-01T00:00:00Z",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

describe("landing-page view helpers", () => {
  it("allows preview only for a published page with a preview URL", () => {
    expect(canPreview(base)).toBe(true);
    expect(canPreview({ ...base, cachedStatus: "hidden", previewUrl: null })).toBe(false);
    expect(canPreview({ ...base, cachedStatus: "draft", previewUrl: null })).toBe(false);
    expect(canPreview({ ...base, previewUrl: null })).toBe(false);
  });

  it("reflects the backend verified flag", () => {
    expect(isVerified(base)).toBe(true);
    expect(isVerified({ ...base, verified: false })).toBe(false);
  });

  it("shows the editor link only when the backend provided one", () => {
    expect(editorLinkVisible(base)).toBe(true);
    expect(editorLinkVisible({ ...base, editorUrl: null })).toBe(false);
  });

  it("prioritises a sync error, then offline, then draft", () => {
    expect(bannerKind(base)).toBeNull();
    expect(bannerKind({ ...base, syncError: "unavailable" })).toBe("syncError");
    expect(bannerKind({ ...base, cachedStatus: "hidden" })).toBe("offline");
    expect(bannerKind({ ...base, cachedStatus: "draft" })).toBe("draft");
    expect(bannerKind({ ...base, cachedStatus: "draft", syncError: "page_not_found" })).toBe("syncError");
  });

  it("labels the section 'Pages marketing' (renamed from 'Landing Pages')", () => {
    expect(t.studio.tabs.landingPages).toBe("Pages marketing");
    expect(t.studio.overview.cards.landingPages).toBe("Pages marketing");
    expect(t.studio.landingPages.title).toBe("Pages marketing");
  });

  it("maps Lirya status + sync errors to French", () => {
    expect(liryaStatusLabel("published")).toBe("Publiée");
    expect(liryaStatusLabel("hidden")).toBe("Hors ligne");
    expect(liryaStatusLabel("draft")).toBe("Brouillon");
    expect(liryaSyncErrorLabel("page_not_found")).toContain("introuvable");
    expect(liryaSyncErrorLabel(null)).toBe("");
  });

  it("maps binding roles to French, unknown falls through", () => {
    expect(liryaRoleLabel("primary")).toBe("Principale");
    expect(liryaRoleLabel("campaign")).toBe("Campagne");
    expect(liryaRoleLabel("ab_variant")).toBe("Variante A/B");
    expect(liryaRoleLabel("locale")).toBe("Locale");
    expect(liryaRoleLabel("weird")).toBe("weird");
    expect(liryaRoleLabel(null)).toBe("—");
  });

  it("computes the roles still free to assign for a product", () => {
    expect(availableRoles([])).toEqual(LANDING_PAGE_ROLES);
    expect(availableRoles([base])).toEqual(["campaign", "ab_variant", "locale"]);
    expect(
      availableRoles([
        { ...base, id: "b1", role: "primary" },
        { ...base, id: "b2", role: "campaign" },
        { ...base, id: "b3", role: "ab_variant" },
        { ...base, id: "b4", role: "locale" },
      ]),
    ).toEqual([]);
  });

  it("canAssociateMore requires Lirya configured AND a free role", () => {
    expect(canAssociateMore(true, [])).toBe(true);
    expect(canAssociateMore(false, [])).toBe(false); // Lirya not configured
    expect(canAssociateMore(true, [base])).toBe(true); // 3 roles left
    expect(
      canAssociateMore(true, [
        { ...base, id: "b1", role: "primary" },
        { ...base, id: "b2", role: "campaign" },
        { ...base, id: "b3", role: "ab_variant" },
        { ...base, id: "b4", role: "locale" },
      ]),
    ).toBe(false); // all roles used
  });

  it("uses 'page marketing' terminology everywhere in the UI copy (no 'page de destination' / 'landing page')", () => {
    const lp = t.studio.landingPages;
    const blob = [
      lp.title,
      lp.subtitle,
      lp.loading,
      lp.notConfiguredHint,
      lp.notConfiguredShort,
      lp.empty,
      lp.emptyHint,
      lp.listHeading(2),
      lp.unassociateBody,
      lp.picker.title,
      lp.picker.intro,
      lp.picker.empty,
      lp.toast.associated,
      lp.toast.unassociated,
      t.studio.tabs.landingPages,
      t.studio.overview.cards.landingPages,
      t.studio.overview.landingPages.none,
      t.studio.overview.landingPages.some(2),
    ].join(" | ").toLowerCase();
    expect(blob).not.toMatch(/page de destination|landing page/);
    expect(blob).toContain("page marketing");
    // "Lirya" stays as the external system name.
    expect(blob).toContain("lirya");
  });

  it("notConfiguredHint points the operator to Paramètres › Intégrations", () => {
    expect(t.studio.landingPages.notConfiguredHint).toContain("Paramètres");
    expect(t.studio.landingPages.notConfiguredHint).toContain("Intégrations");
  });

  it("the product-status hint states the Volrep / Lirya boundary", () => {
    const hint = t.products.info.statusHint(false);
    expect(hint).toContain("boutique Volrep");
    expect(hint).toMatch(/n['’]affecte pas les pages marketing lirya/i);
    expect(t.products.info.statusHint(true)).toContain("Réservé au propriétaire");
  });
});
