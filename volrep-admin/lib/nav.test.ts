import { describe, expect, it } from "vitest";
import { NAV_GROUPS, NAV_ITEMS, visibleGroups, currentNavLabel, isActive } from "./nav";
import { t } from "./i18n";

describe("admin navigation — Store Control Center structure", () => {
  it("has exactly the Boutique / Catalogue / Paramètres groups", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([
      t.nav.groups.store,
      t.nav.groups.catalog,
      t.nav.groups.settings,
    ]);
  });

  it("Boutique group is Tableau de bord · Commandes · Analytics", () => {
    const store = NAV_GROUPS.find((g) => g.label === t.nav.groups.store);
    expect(store?.items.map((i) => i.href)).toEqual(["/", "/orders", "/analytics"]);
  });

  it("Paramètres group is Livraison · Journal d’audit · Paramètres · Intégrations", () => {
    const settings = NAV_GROUPS.find((g) => g.label === t.nav.groups.settings);
    expect(settings?.items.map((i) => i.href)).toEqual([
      "/shipping",
      "/audit-log",
      "/settings",
      "/integrations",
    ]);
  });

  it("settings, integrations and analytics are visible to staff (read access), writes gated server-side", () => {
    const staffHrefs = visibleGroups("staff").flatMap((g) => g.items.map((i) => i.href));
    expect(staffHrefs).toContain("/settings");
    expect(staffHrefs).toContain("/integrations");
    expect(staffHrefs).toContain("/analytics");
  });

  it("Analytics carries no ownerOnly flag (read for every admin)", () => {
    const analytics = NAV_ITEMS.find((i) => i.href === "/analytics");
    expect(analytics?.ownerOnly).toBeUndefined();
  });

  it("resolves the topbar title for the new routes", () => {
    expect(currentNavLabel("/settings")).toBe(t.nav.items.settings);
    expect(currentNavLabel("/integrations")).toBe(t.nav.items.integrations);
    expect(currentNavLabel("/analytics")).toBe(t.nav.items.analytics);
    expect(isActive("/settings", "/settings")).toBe(true);
  });
});
