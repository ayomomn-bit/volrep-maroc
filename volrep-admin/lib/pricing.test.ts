import { describe, expect, it } from "vitest";
import { discountPercent, MONEY_RE, validateSimpleCommerce } from "./pricing";

describe("discountPercent", () => {
  it("computes a rounded percentage for a genuine discount", () => {
    expect(discountPercent("899.00", "1099.00")).toBe(18);
    expect(discountPercent(50, 100)).toBe(50);
  });
  it("returns null when there is no real discount", () => {
    expect(discountPercent("899.00", null)).toBeNull();
    expect(discountPercent("899.00", "")).toBeNull();
    expect(discountPercent("899.00", "899.00")).toBeNull();
    expect(discountPercent("899.00", "800.00")).toBeNull();
    expect(discountPercent("899.00", "abc")).toBeNull();
  });
});

describe("MONEY_RE", () => {
  it("accepts non-negative amounts with up to 2 decimals", () => {
    expect(MONEY_RE.test("0")).toBe(true);
    expect(MONEY_RE.test("899")).toBe(true);
    expect(MONEY_RE.test("899.5")).toBe(true);
    expect(MONEY_RE.test("899.50")).toBe(true);
  });
  it("rejects negatives, letters and 3+ decimals", () => {
    expect(MONEY_RE.test("-5")).toBe(false);
    expect(MONEY_RE.test("5.999")).toBe(false);
    expect(MONEY_RE.test("abc")).toBe(false);
    expect(MONEY_RE.test("")).toBe(false);
  });
});

// Simple-product commerce form validation — mirrors the backend's
// assertMoneyString / assertCompareAtAbovePrice checks (volrep-backend's
// services/admin/variants.ts, reused for a simple product's price).
describe("validateSimpleCommerce", () => {
  it("accepts a valid price with no compare-at", () => {
    expect(validateSimpleCommerce("299.00", "")).toBeNull();
  });

  it("accepts a compare-at strictly above the price", () => {
    expect(validateSimpleCommerce("299.00", "399.00")).toBeNull();
  });

  it("requires a price", () => {
    expect(validateSimpleCommerce("", "")).toBe("priceRequired");
    expect(validateSimpleCommerce("   ", "")).toBe("priceRequired");
  });

  it("rejects an invalid price", () => {
    expect(validateSimpleCommerce("-5", "")).toBe("priceInvalid");
    expect(validateSimpleCommerce("abc", "")).toBe("priceInvalid");
  });

  it("rejects an invalid compare-at", () => {
    expect(validateSimpleCommerce("299.00", "abc")).toBe("compareAtInvalid");
  });

  it("rejects a compare-at at or below the price", () => {
    expect(validateSimpleCommerce("299.00", "299.00")).toBe("compareAtNotAbovePrice");
    expect(validateSimpleCommerce("299.00", "200.00")).toBe("compareAtNotAbovePrice");
  });
});
