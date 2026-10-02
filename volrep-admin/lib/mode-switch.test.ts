import { describe, expect, it } from "vitest";
import { switchToSimpleBlockedReason } from "./mode-switch";

describe("switchToSimpleBlockedReason", () => {
  // scenario #17 — toggle disabled when the product has more than one variant
  it("blocks with 'multiple' when there is more than one variant", () => {
    expect(switchToSimpleBlockedReason(2)).toBe("multiple");
    expect(switchToSimpleBlockedReason(5)).toBe("multiple");
  });

  it("allows the switch with zero variants — the backend creates a fresh Default Variant", () => {
    expect(switchToSimpleBlockedReason(0)).toBeNull();
  });

  it("allows the switch with exactly one variant", () => {
    expect(switchToSimpleBlockedReason(1)).toBeNull();
  });
});
