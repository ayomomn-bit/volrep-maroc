import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_SECTION_TYPES,
  homepageDocumentSchema,
  isHomepageSectionType,
  parseHomepageDocument,
  parseHomepageSectionData,
  siteMediaIdsInDocument,
} from "./schema.js";
import { DEFAULT_HOMEPAGE_DOCUMENT, DEFAULT_HOMEPAGE_SECTION_ORDER } from "./defaults.js";

const EXPECTED_ORDER = [
  "hero",
  "bestSellers",
  "recoveryPhilosophy",
  "recoverEverywhere",
  "whyVolrep",
  "testimonials",
  "faq",
  "finalCta",
  "newsletter",
];

function cloneDefault() {
  return structuredClone(DEFAULT_HOMEPAGE_DOCUMENT) as typeof DEFAULT_HOMEPAGE_DOCUMENT;
}

describe("homepage schema", () => {
  it("has one schema per known section type", () => {
    expect([...HOMEPAGE_SECTION_TYPES].sort()).toEqual([...EXPECTED_ORDER].sort());
    expect(isHomepageSectionType("hero")).toBe(true);
    expect(isHomepageSectionType("promoBar")).toBe(false);
    expect(isHomepageSectionType("header")).toBe(false);
  });

  it("accepts the code-owned default document and keeps section order", () => {
    expect(() => parseHomepageDocument(DEFAULT_HOMEPAGE_DOCUMENT)).not.toThrow();
    expect(DEFAULT_HOMEPAGE_SECTION_ORDER).toEqual(EXPECTED_ORDER);
    expect(DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) => s.type)).toEqual(EXPECTED_ORDER);
    expect(DEFAULT_HOMEPAGE_DOCUMENT.sections.every((s) => s.enabled)).toBe(true);
  });

  it("preserves the current homepage copy 1:1 (spot checks)", () => {
    const byId = Object.fromEntries(DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) => [s.id, s.data]));
    expect((byId.hero as { heading: string }).heading).toBe("Récupérez chaque jour.");
    expect((byId.bestSellers as { heading: string }).heading).toBe("Meilleures ventes");
    expect((byId.bestSellers as { source: { mode: string; limit: number } }).source).toEqual({
      mode: "catalog",
      limit: 8,
    });
    expect((byId.faq as { items: unknown[] }).items).toHaveLength(6);
    expect((byId.testimonials as { cards: { name: string }[] }).cards.map((c) => c.name)).toEqual([
      "Michael R.",
      "Sarah K.",
      "Daniel T.",
    ]);
    expect((byId.whyVolrep as { stats: { value: number }[] }).stats.map((s) => s.value)).toEqual([
      5, 3, 365, 2,
    ]);
    expect((byId.finalCta as { badges: { label: string }[] }).badges.map((b) => b.label)).toEqual([
      "Livraison offerte",
      "Garantie 2 ans",
      "Retours sous 30 jours",
    ]);
  });

  it("keeps the six current homepage image URLs verbatim as url slots", () => {
    const doc = DEFAULT_HOMEPAGE_DOCUMENT;
    const bg = doc.sections.find((s) => s.type === "recoveryPhilosophy")!;
    expect((bg.data as { background: { kind: string; url: string } }).background.kind).toBe("url");
    expect((bg.data as { background: { url: string } }).background.url).toBe(
      "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/VOLREP-Section-3-Background.webp?v=1786449309",
    );
    const zones = doc.sections.find((s) => s.type === "recoverEverywhere")!;
    const urls = (zones.data as { zones: { media: { url: string } }[] }).zones.map((z) => z.media.url);
    expect(urls).toEqual([
      "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/Back-recovery.webp",
      "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/Neck-recovery.webp",
      "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/Leg-recovery.webp",
      "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/Shoulder-recovery.webp",
      "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/Foot-recovery.webp",
    ]);
    // No kind:"image" slots in the default → no site_media references.
    expect(siteMediaIdsInDocument(doc)).toEqual([]);
  });

  it("rejects unknown keys in a section payload (.strict)", () => {
    expect(() => parseHomepageSectionData("newsletter", { extra: 1 })).toThrow();
  });

  it("rejects an unknown section type", () => {
    const doc = cloneDefault() as unknown as { sections: unknown[] };
    doc.sections.push({ id: "x", type: "promoBar", enabled: true, data: {} });
    expect(() => parseHomepageDocument(doc)).toThrow();
  });

  it("rejects duplicate section ids", () => {
    const doc = cloneDefault();
    doc.sections[1]!.id = doc.sections[0]!.id;
    expect(() => parseHomepageDocument(doc)).toThrow(/duplicate section id/);
  });

  it("rejects a document missing a required V1 section", () => {
    const doc = cloneDefault();
    doc.sections = doc.sections.filter((s) => s.type !== "faq");
    expect(() => parseHomepageDocument(doc)).toThrow(/missing required section/);
  });

  it("rejects a document with a duplicated section type", () => {
    const doc = cloneDefault();
    const faq = structuredClone(doc.sections.find((s) => s.type === "faq")!);
    faq.id = "faq-2";
    doc.sections.push(faq);
    expect(() => parseHomepageDocument(doc)).toThrow(/exactly once/);
  });

  it("allows reordering and disabling sections", () => {
    const doc = cloneDefault();
    doc.sections.reverse();
    doc.sections.find((s) => s.type === "newsletter")!.enabled = false;
    expect(() => parseHomepageDocument(doc)).not.toThrow();
  });

  it("rejects a disallowed media URL scheme", () => {
    const doc = cloneDefault();
    (doc.sections.find((s) => s.type === "recoveryPhilosophy")!.data as { background: { url: string } }).background.url =
      "javascript:alert(1)";
    expect(() => parseHomepageDocument(doc)).toThrow();
  });

  it("rejects a disallowed CTA href scheme", () => {
    const doc = cloneDefault();
    (doc.sections.find((s) => s.type === "hero")!.data as { primaryCta: { href: string } }).primaryCta.href =
      "javascript:alert(1)";
    expect(() => parseHomepageDocument(doc)).toThrow();
  });

  it("collects site_media ids from image slots", () => {
    const doc = cloneDefault();
    const id = "11111111-1111-4111-8111-111111111111";
    (doc.sections.find((s) => s.type === "recoveryPhilosophy")!.data as {
      background: { kind: string; imageId: string | null; url: string };
    }).background = { kind: "image", imageId: id, url: "" } as never;
    const parsed = parseHomepageDocument(doc);
    expect(siteMediaIdsInDocument(parsed)).toEqual([id]);
  });

  it("version must be 1", () => {
    expect(() => homepageDocumentSchema.parse({ version: 2, settings: {}, sections: [] })).toThrow();
  });
});
