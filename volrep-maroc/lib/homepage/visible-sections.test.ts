import { describe, expect, it } from "vitest";
import { visibleHomepageSections } from "./visible-sections";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "./default-document";
import type { HomepageDocument } from "./types";

describe("visibleHomepageSections", () => {
  it("includes all 9 section types from the default document, enabled and in document order", () => {
    const result = visibleHomepageSections(DEFAULT_HOMEPAGE_DOCUMENT);

    expect(result.map((s) => s.type)).toEqual([
      "hero",
      "bestSellers",
      "recoveryPhilosophy",
      "recoverEverywhere",
      "whyVolrep",
      "testimonials",
      "faq",
      "finalCta",
      "newsletter",
    ]);
  });

  it("drops sections whose enabled flag is false, keeping the rest in order", () => {
    const doc: HomepageDocument = {
      ...DEFAULT_HOMEPAGE_DOCUMENT,
      sections: DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) =>
        s.type === "testimonials" || s.type === "newsletter" ? { ...s, enabled: false } : s,
      ),
    };

    const result = visibleHomepageSections(doc);

    expect(result.map((s) => s.type)).toEqual([
      "hero",
      "bestSellers",
      "recoveryPhilosophy",
      "recoverEverywhere",
      "whyVolrep",
      "faq",
      "finalCta",
    ]);
  });

  it("follows document order even when it differs from the canonical V1 order (reorder support)", () => {
    const [hero, ...rest] = DEFAULT_HOMEPAGE_DOCUMENT.sections;
    const doc: HomepageDocument = { ...DEFAULT_HOMEPAGE_DOCUMENT, sections: [...rest, hero] };

    const result = visibleHomepageSections(doc);

    expect(result[result.length - 1].type).toBe("hero");
    expect(result[0].type).toBe("bestSellers");
  });

  it("does not mutate the enabled sections' data", () => {
    const result = visibleHomepageSections(DEFAULT_HOMEPAGE_DOCUMENT);
    expect(result).toEqual(DEFAULT_HOMEPAGE_DOCUMENT.sections);
  });
});
