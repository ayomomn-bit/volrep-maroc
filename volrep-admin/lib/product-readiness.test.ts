import { describe, expect, it } from "vitest";
import type { StudioCompleteness } from "@/lib/types";
import { productReadiness } from "@/lib/product-readiness";

const completeness = (over: Partial<StudioCompleteness> = {}): StudioCompleteness => ({
  media: { total: 1, owned: 1, ready: true },
  landingPages: { total: 0, linked: 0, verified: 0, needsAttention: false },
  commerce: { variants: 1, priced: true, published: false },
  ...over,
});

describe("productReadiness", () => {
  it("is ready with a price and at least one image — a Lirya page is NOT required", () => {
    const r = productReadiness(completeness({ landingPages: { total: 0, linked: 0, verified: 0, needsAttention: false } }));
    expect(r.isReady).toBe(true);
    expect(r.ready).toBe(2);
    expect(r.total).toBe(2);
    expect(r.missing).toBe(0);
  });

  it("having a bound Lirya page does not change readiness", () => {
    const without = productReadiness(completeness({ landingPages: { total: 0, linked: 0, verified: 0, needsAttention: false } }));
    const withPage = productReadiness(completeness({ landingPages: { total: 2, linked: 2, verified: 1, needsAttention: true } }));
    expect(withPage).toEqual(without);
  });

  it("counts only price + media as missing", () => {
    expect(productReadiness(completeness({ commerce: { variants: 0, priced: false, published: false } })).missing).toBe(1);
    expect(
      productReadiness(
        completeness({
          commerce: { variants: 0, priced: false, published: false },
          media: { total: 0, owned: 0, ready: false },
        }),
      ).missing,
    ).toBe(2);
  });
});
