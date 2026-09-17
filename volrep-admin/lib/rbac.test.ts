import { describe, expect, it } from "vitest";
import { can } from "./rbac";

describe("rbac.can (UI affordance only — backend is authoritative)", () => {
  it("grants an owner everything", () => {
    expect(can("owner", "product.create")).toBe(true);
    expect(can("owner", "product.setStatus")).toBe(true);
    expect(can("owner", "shipping.write")).toBe(true);
    expect(can("owner", "settings.write")).toBe(true);
    expect(can("owner", "integrations.test")).toBe(true);
  });

  it("withholds owner-only capabilities from staff", () => {
    expect(can("staff", "product.create")).toBe(false);
    expect(can("staff", "product.setStatus")).toBe(false);
    expect(can("staff", "shipping.write")).toBe(false);
    expect(can("staff", "settings.write")).toBe(false);
    expect(can("staff", "integrations.test")).toBe(false);
  });

  it("denies everything when the role is unknown", () => {
    expect(can(undefined, "product.create")).toBe(false);
  });
});
