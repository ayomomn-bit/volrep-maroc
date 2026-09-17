import { describe, expect, it } from "vitest";
import type { HomepageSection } from "@/lib/types";
import { t } from "@/lib/i18n";
import { NAV_ITEMS, NAV_GROUPS, currentNavLabel, isActive, visibleGroups } from "@/lib/nav";
import {
  HOMEPAGE_SECTION_ORDER,
  hasUnpublishedChanges,
  homepageOverviewStats,
  moveSection,
  sectionDescription,
  sectionLabel,
  sectionSummary,
  setSectionAt,
  toHomepageDocument,
} from "@/lib/homepage-studio";

// ---- a full, schema-shaped 9-section fixture ------------------------

function ph(label = "") {
  return { kind: "placeholder" as const, imageId: null, url: "", poster: "", alt: "", placeholderLabel: label, mediaType: "image" as const, fileName: "" };
}

function fixture(): HomepageSection[] {
  return [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      data: {
        eyebrow: "Récupération",
        heading: "Récupérez chaque jour.",
        body: "…",
        primaryCta: { label: "Acheter la récupération", href: "/products/volrep-prm" },
        secondaryCta: { label: "Découvrir le VOLREP PRM™", href: "/products/volrep-prm" },
        visual: { media: ph(), badge: "01", productName: "VOLREP PRM™", caption: "Masseur de récupération percussive" },
      },
    },
    {
      id: "bestSellers",
      type: "bestSellers",
      enabled: true,
      data: { eyebrow: "Boutique", heading: "Meilleures ventes", body: "…", source: { mode: "catalog", limit: 8 } },
    },
    {
      id: "recoveryPhilosophy",
      type: "recoveryPhilosophy",
      enabled: true,
      data: { eyebrow: "Récupération", heading: "La récupération n'est pas\nune option secondaire.", body: "…", cta: { label: "Découvrir la récupération", href: "/products/volrep-prm" }, background: ph() },
    },
    {
      id: "recoverEverywhere",
      type: "recoverEverywhere",
      enabled: true,
      data: {
        heading: "Récupérez\npartout.",
        subtitle: "…",
        ctaLabel: "Découvrir",
        ctaHref: "/products/volrep-prm",
        zones: Array.from({ length: 5 }, (_, i) => ({ title: `z${i}`, description: "d", media: ph(), objectPosition: "object-right", span: "lg:col-span-2" })),
      },
    },
    {
      id: "whyVolrep",
      type: "whyVolrep",
      enabled: true,
      data: {
        eyebrow: "Technologie",
        heading: "Pourquoi\nVolrep ?",
        subtitle: "…",
        features: [
          { number: "01", title: "Matériaux premium", description: "…", icon: "shield" },
          { number: "02", title: "Soulagement musculaire profond", description: "…", icon: "wave" },
          { number: "03", title: "Performance silencieuse", description: "…", icon: "soundwave" },
          { number: "04", title: "Conçu pour durer", description: "…", icon: "check" },
        ],
        stats: [
          { value: 5, suffix: "+", label: "Modes de récupération" },
          { value: 3, suffix: "h", label: "Autonomie" },
          { value: 365, suffix: "", label: "Jours de récupération" },
          { value: 2, suffix: " ans", label: "Garantie" },
        ],
      },
    },
    {
      id: "testimonials",
      type: "testimonials",
      enabled: true,
      data: {
        eyebrow: "Avis",
        heading: "Adopté par les sportifs.\nApprouvé chaque jour.",
        body: "…",
        rating: { stars: "★★★★★", label: "Note de 4,9/5", description: "Sur la base de plus de 2 000 clients vérifiés" },
        verifiedLabel: "Client vérifié",
        cards: [
          { name: "Michael R.", quote: "…" },
          { name: "Sarah K.", quote: "…" },
          { name: "Daniel T.", quote: "…" },
        ],
        trustline: { rating: "4.9/5", label: "Ils nous font confiance", audiences: ["Sportifs", "Kinésithérapeutes", "Coachs sportifs"] },
        trustItems: [
          { value: "95 000+", label: "Clients satisfaits" },
          { value: "4,9★", label: "Note moyenne" },
          { value: "30 jours", label: "Satisfait ou remboursé" },
          { value: "2 ans", label: "Garantie" },
        ],
      },
    },
    {
      id: "faq",
      type: "faq",
      enabled: true,
      data: {
        eyebrow: "FAQ",
        heading: "Questions fréquentes",
        subtitle: "…",
        defaultOpen: -1,
        items: Array.from({ length: 6 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })),
      },
    },
    {
      id: "finalCta",
      type: "finalCta",
      enabled: true,
      data: {
        eyebrow: "Commencez aujourd’hui",
        heading: "Mieux récupérer.\nBouger plus fort.",
        body: "…",
        primaryCta: { label: "Acheter maintenant", href: "/products/volrep-prm" },
        secondaryCta: { label: "En savoir plus", href: "#why-volrep-heading" },
        rating: { stars: "★★★★★", label: "Note de 4,9/5" },
        badges: [
          { icon: "truck", label: "Livraison offerte" },
          { icon: "shield", label: "Garantie 2 ans" },
          { icon: "return", label: "Retours sous 30 jours" },
        ],
      },
    },
    {
      id: "newsletter",
      type: "newsletter",
      enabled: true,
      data: {
        eyebrow: "Newsletter",
        heading: "Restez en\nrécupération.",
        body: "…",
        emailLabel: "Adresse e-mail",
        emailPlaceholder: "Entrez votre e-mail",
        submitLabel: "S’inscrire",
        successMessage: "Vous êtes inscrit. Bienvenue chez VOLREP.",
      },
    },
  ];
}

describe("homepage-studio helpers", () => {
  it("HOMEPAGE_SECTION_ORDER is the 9 V1 types in canonical order", () => {
    expect(HOMEPAGE_SECTION_ORDER).toEqual([
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
    expect(fixture().map((s) => s.type)).toEqual(HOMEPAGE_SECTION_ORDER);
  });

  it("every section type has a French label and description", () => {
    for (const type of HOMEPAGE_SECTION_ORDER) {
      expect(sectionLabel(type).length).toBeGreaterThan(0);
      expect(sectionLabel(type)).not.toBe(type);
      expect(sectionDescription(type).length).toBeGreaterThan(0);
    }
    expect(sectionLabel("recoveryPhilosophy")).toBe(t.homepage.sectionLabels.recoveryPhilosophy);
  });

  it("moveSection reorders without mutating the input", () => {
    const list = fixture();
    const moved = moveSection(list, 0, 8);
    expect(moved.map((s) => s.type)).toEqual([
      "bestSellers",
      "recoveryPhilosophy",
      "recoverEverywhere",
      "whyVolrep",
      "testimonials",
      "faq",
      "finalCta",
      "newsletter",
      "hero",
    ]);
    expect(list.map((s) => s.type)).toEqual(HOMEPAGE_SECTION_ORDER); // unchanged
  });

  it("moveSection is a no-op for equal / out-of-range indices", () => {
    const list = fixture();
    expect(moveSection(list, 0, 0)).toBe(list);
    expect(moveSection(list, 0, 99)).toBe(list);
    expect(moveSection(list, -1, 2)).toBe(list);
  });

  it("setSectionAt is pure (toggling enabled keeps every section, never deletes)", () => {
    const list = fixture();
    const next = setSectionAt(list, 6, (s) => ({ ...s, enabled: false }) as HomepageSection);
    expect(next).toHaveLength(9);
    expect(next[6]!.enabled).toBe(false);
    expect(next[6]!.type).toBe("faq");
    expect(next[6]!.data).toEqual(list[6]!.data); // content preserved
    expect(list[6]!.enabled).toBe(true); // input untouched
  });

  it("homepageOverviewStats counts sections and enabled sections", () => {
    const list = setSectionAt(fixture(), 8, (s) => ({ ...s, enabled: false }) as HomepageSection);
    const stats = homepageOverviewStats(toHomepageDocument(list));
    expect(stats.sectionCount).toBe(9);
    expect(stats.enabledCount).toBe(8);
    expect(stats.hiddenCount).toBe(1);
  });

  it("sectionSummary returns a non-crashing string for every section type", () => {
    for (const section of fixture()) {
      const s = sectionSummary(section);
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it("hasUnpublishedChanges combines server + local dirty state", () => {
    expect(hasUnpublishedChanges({ hasPublished: false, draftMatchesPublished: false }, false)).toBe(true);
    expect(hasUnpublishedChanges({ hasPublished: true, draftMatchesPublished: true }, false)).toBe(false);
    expect(hasUnpublishedChanges({ hasPublished: true, draftMatchesPublished: true }, true)).toBe(true);
    expect(hasUnpublishedChanges({ hasPublished: true, draftMatchesPublished: false }, false)).toBe(true);
  });

  it("toHomepageDocument wraps sections in the version-1 envelope", () => {
    const doc = toHomepageDocument(fixture());
    expect(doc.version).toBe(1);
    expect(doc.settings).toEqual({});
    expect(doc.sections).toHaveLength(9);
  });
});

describe("homepage navigation entry", () => {
  it("adds /homepage to the Catalogue group between Produits and Avis", () => {
    const catalog = NAV_GROUPS.find((g) => g.label === t.nav.groups.catalog);
    expect(catalog?.items.map((i) => i.href)).toEqual(["/products", "/homepage", "/reviews"]);
  });

  it("Homepage Studio is visible to staff (no ownerOnly flag)", () => {
    const item = NAV_ITEMS.find((i) => i.href === "/homepage");
    expect(item?.ownerOnly).toBeUndefined();
    const staffHrefs = visibleGroups("staff").flatMap((g) => g.items.map((i) => i.href));
    expect(staffHrefs).toContain("/homepage");
  });

  it("resolves the topbar title and active state for /homepage", () => {
    expect(currentNavLabel("/homepage")).toBe(t.nav.items.homepage);
    expect(isActive("/homepage", "/homepage")).toBe(true);
    expect(isActive("/", "/homepage")).toBe(false);
  });
});
