import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "./default-document";
import { isHomepageDocument } from "./types";
import type { HomepageSection, HomepageSectionType } from "./types";

function section<T extends HomepageSectionType>(type: T): Extract<HomepageSection, { type: T }> {
  const found = DEFAULT_HOMEPAGE_DOCUMENT.sections.find((s) => s.type === type);
  if (!found) throw new Error(`missing section ${type}`);
  return found as Extract<HomepageSection, { type: T }>;
}

describe("DEFAULT_HOMEPAGE_DOCUMENT", () => {
  it("is a structurally valid homepage document", () => {
    expect(isHomepageDocument(DEFAULT_HOMEPAGE_DOCUMENT)).toBe(true);
  });

  it("preserves every existing CTA URL unchanged", () => {
    const hero = section("hero");
    expect(hero.data.primaryCta.href).toBe("/products/volrep-prm");
    expect(hero.data.secondaryCta.href).toBe("/products/volrep-prm");

    const recoveryPhilosophy = section("recoveryPhilosophy");
    expect(recoveryPhilosophy.data.cta.href).toBe("/products/volrep-prm");

    const recoverEverywhere = section("recoverEverywhere");
    expect(recoverEverywhere.data.ctaHref).toBe("/products/volrep-prm");

    const finalCta = section("finalCta");
    expect(finalCta.data.primaryCta.href).toBe("/products/volrep-prm");
    expect(finalCta.data.secondaryCta.href).toBe("#why-volrep-heading");
  });

  it("preserves the existing FAQ content (6 questions, exact order)", () => {
    const faq = section("faq").data;
    expect(faq.items).toHaveLength(6);
    expect(faq.items.map((i) => i.question)).toEqual([
      "Sur quels muscles peut-on utiliser VOLREP ?",
      "À quelle fréquence l’utiliser ?",
      "Convient-il aux débutants ?",
      "Quelle est l’autonomie de la batterie ?",
      "Est-il garanti ?",
      "Et si je ne suis pas satisfait ?",
    ]);
    // -1 = all collapsed on load, today's default-open behaviour.
    expect(faq.defaultOpen).toBe(-1);
  });

  it("preserves the existing testimonial content (3 cards, names and quotes)", () => {
    const testimonials = section("testimonials").data;
    expect(testimonials.cards.map((c) => c.name)).toEqual(["Michael R.", "Sarah K.", "Daniel T."]);
    expect(testimonials.cards.every((c) => c.quote.length > 0)).toBe(true);
  });

  it("keeps the 6 existing Shopify-CDN media URLs unchanged (no site_media migration in this step)", () => {
    const recoveryPhilosophy = section("recoveryPhilosophy");
    expect(recoveryPhilosophy.data.background.kind).toBe("url");
    expect(recoveryPhilosophy.data.background.url).toContain("cdn.shopify.com");

    const recoverEverywhere = section("recoverEverywhere");
    expect(recoverEverywhere.data.zones).toHaveLength(5);
    for (const zone of recoverEverywhere.data.zones) {
      expect(zone.media.kind).toBe("url");
      expect(zone.media.url).toContain("cdn.shopify.com");
    }
  });

  it("keeps the hero visual as a placeholder (no invented hero image)", () => {
    const hero = section("hero");
    expect(hero.data.visual.media.kind).toBe("placeholder");
  });

  it("has every section enabled and Best Sellers pulling 8 catalog products (today's behaviour)", () => {
    expect(DEFAULT_HOMEPAGE_DOCUMENT.sections.every((s) => s.enabled)).toBe(true);
    const bestSellers = section("bestSellers");
    expect(bestSellers.data.source).toEqual({ mode: "catalog", limit: 8 });
  });
});
