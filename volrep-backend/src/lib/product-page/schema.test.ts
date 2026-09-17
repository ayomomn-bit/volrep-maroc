import { describe, expect, it } from "vitest";
import {
  imageIdsInDocument,
  isSectionType,
  parsePageDocument,
  parseSectionData,
  pageDocumentSchema,
  SECTION_TYPES,
} from "./schema.js";
import { DEFAULT_PAGE_DOCUMENT, DEFAULT_SECTION_ORDER } from "./defaults.js";

const EXPECTED_ORDER = [
  "hero",
  "ugc",
  "descriptionFaq",
  "professionals",
  "bigResult",
  "benefits",
  "sayGoodbye",
  "endorsement",
  "comparison",
  "reviews",
  "trust",
  "faq",
  "problemSolution",
  "order",
  "stickyCta",
];

describe("product-page schema", () => {
  it("has one schema per known section type", () => {
    expect([...SECTION_TYPES].sort()).toEqual([...EXPECTED_ORDER].sort());
    expect(isSectionType("hero")).toBe(true);
    expect(isSectionType("promoBar")).toBe(false);
  });

  it("rejects unknown keys in a section payload (.strict)", () => {
    expect(() => parseSectionData("stickyCta", { label: "x", extra: 1 })).toThrow();
  });

  it("rejects a comparison row with the wrong number of competitor cells", () => {
    expect(() =>
      parseSectionData("comparison", {
        heading: "h",
        subtitle: "s",
        productName: "p",
        competitors: ["A", "B"],
        rows: [{ label: "r", product: "yes", competitors: ["yes"] }],
      }),
    ).toThrow();
  });

  it("rejects a document with duplicate section ids", () => {
    expect(() =>
      parsePageDocument({
        version: 1,
        settings: {},
        sections: [
          { id: "dup", type: "stickyCta", enabled: true, data: { label: "a" } },
          { id: "dup", type: "order", enabled: true, data: { title: "t", subtitle: "s" } },
        ],
      }),
    ).toThrow();
  });

  it("fills media-slot defaults on parse", () => {
    const parsed = parseSectionData("bigResult", {
      heading: "h",
      media: { kind: "placeholder", placeholderLabel: "x" },
      disclaimer: "d",
    });
    expect(parsed.media).toEqual({
      kind: "placeholder",
      imageId: null,
      url: "",
      poster: "",
      alt: "",
      placeholderLabel: "x",
      mediaType: "image",
      fileName: "",
    });
  });

  it("accepts a UGC video slot (kind:url + mediaType:video + fileName)", () => {
    const parsed = parseSectionData("ugc", {
      heading: "Ce que disent nos clients",
      videos: [
        {
          media: {
            kind: "url",
            url: "http://localhost:4000/media/products/abc.mp4",
            mediaType: "video",
            fileName: "UGC_01.mp4",
            poster: "",
          },
        },
      ],
    });
    expect(parsed.videos[0]!.media).toMatchObject({
      kind: "url",
      mediaType: "video",
      fileName: "UGC_01.mp4",
      url: "http://localhost:4000/media/products/abc.mp4",
    });
  });

  it("accepts a UGC gif slot (kind:url + mediaType:gif)", () => {
    const parsed = parseSectionData("ugc", {
      heading: "h",
      videos: [
        { media: { kind: "url", url: "http://localhost:4000/media/products/abc.gif", mediaType: "gif", fileName: "UGC_01.gif" } },
      ],
    });
    expect(parsed.videos[0]!.media).toMatchObject({ kind: "url", mediaType: "gif", fileName: "UGC_01.gif" });
  });

  it("defaults comparison.media to an empty placeholder when the key is absent (legacy docs)", () => {
    const parsed = parseSectionData("comparison", {
      heading: "h",
      subtitle: "s",
      productName: "p",
      competitors: ["A"],
      rows: [{ label: "r", product: "yes", competitors: ["no"] }],
    });
    expect(parsed.media).toEqual({
      kind: "placeholder",
      imageId: null,
      url: "",
      poster: "",
      alt: "",
      placeholderLabel: "",
      mediaType: "image",
      fileName: "",
    });
  });

  it("keeps a chosen comparison image slot", () => {
    const parsed = parseSectionData("comparison", {
      heading: "h",
      subtitle: "s",
      productName: "p",
      media: { kind: "image", imageId: "11111111-1111-1111-1111-111111111111" },
      competitors: ["A"],
      rows: [{ label: "r", product: "yes", competitors: ["no"] }],
    });
    expect(parsed.media).toMatchObject({ kind: "image", imageId: "11111111-1111-1111-1111-111111111111" });
  });

  it("rejects an unknown mediaType", () => {
    expect(() =>
      parseSectionData("ugc", {
        heading: "h",
        videos: [{ media: { kind: "url", url: "x", mediaType: "audio" } }],
      }),
    ).toThrow();
  });
});

describe("DEFAULT_PAGE_DOCUMENT — 1:1 with the live product page", () => {
  it("is a valid page document", () => {
    expect(() => pageDocumentSchema.parse(DEFAULT_PAGE_DOCUMENT)).not.toThrow();
    expect(DEFAULT_PAGE_DOCUMENT.version).toBe(1);
  });

  it("has exactly the current sections in the current order", () => {
    expect(DEFAULT_SECTION_ORDER).toEqual(EXPECTED_ORDER);
  });

  it("has every section enabled (matching today's page)", () => {
    for (const section of DEFAULT_PAGE_DOCUMENT.sections) {
      expect(section.enabled).toBe(true);
    }
    const hero = DEFAULT_PAGE_DOCUMENT.sections.find((s) => s.type === "hero");
    expect(hero?.type).toBe("hero");
    if (hero?.type === "hero") expect(hero.data.beforeAfter.enabled).toBe(true);
  });

  it("references no product images yet (all media slots are placeholders)", () => {
    expect(imageIdsInDocument(DEFAULT_PAGE_DOCUMENT)).toEqual([]);
    for (const section of DEFAULT_PAGE_DOCUMENT.sections) {
      const slots: { kind: string }[] = [];
      if (section.type === "hero") {
        for (const zone of section.data.beforeAfter.zones) slots.push(zone.media);
      } else if (section.type === "ugc") {
        for (const video of section.data.videos) slots.push(video.media);
      } else if (
        section.type === "bigResult" ||
        section.type === "benefits" ||
        section.type === "sayGoodbye"
      ) {
        slots.push(section.data.media);
      }
      for (const slot of slots) expect(slot.kind).toBe("placeholder");
    }
  });

  it("keeps the exact hero copy", () => {
    const hero = DEFAULT_PAGE_DOCUMENT.sections.find((s) => s.type === "hero");
    if (hero?.type !== "hero") throw new Error("hero section missing");
    expect(hero.data.subtitle).toBe("Masseur de récupération percussive");
    expect(hero.data.ctaLabel).toBe("Commander maintenant — {price}");
    expect(hero.data.features.map((f: { label: string }) => f.label)).toEqual([
      "Mains libres",
      "Sans douleur",
      "Design ergonomique",
      "Sans fil · USB-C",
    ]);
    expect(hero.data.description[0]).toContain("masseur de récupération percussive 2-en-1");
  });

  it("keeps all 6 FAQ questions and the mini-accordion open-by-default", () => {
    const faq = DEFAULT_PAGE_DOCUMENT.sections.find((s) => s.type === "faq");
    const mini = DEFAULT_PAGE_DOCUMENT.sections.find((s) => s.type === "descriptionFaq");
    if (faq?.type !== "faq" || mini?.type !== "descriptionFaq") throw new Error("faq sections missing");
    expect(faq.data.items).toHaveLength(6);
    expect(faq.data.defaultOpen).toBe(0);
    expect(mini.data.items).toHaveLength(4);
    expect(mini.data.items[0]?.question).toBe("Description");
  });

  it("keeps the 6 comparison rows with their yes/no/partial states", () => {
    const cmp = DEFAULT_PAGE_DOCUMENT.sections.find((s) => s.type === "comparison");
    if (cmp?.type !== "comparison") throw new Error("comparison section missing");
    expect(cmp.data.competitors).toEqual(["Pistolet de massage", "Massage en institut"]);
    expect(cmp.data.rows).toHaveLength(6);
    expect(cmp.data.rows.every((r: { product: string }) => r.product === "yes")).toBe(true);
    expect(cmp.data.rows[1]).toMatchObject({
      label: "Massage roulant + percussif combiné",
      competitors: ["no", "partial"],
    });
  });
});
