import { z } from "zod";

// ---------------------------------------------------------------------------
// Homepage Studio document — the ONE place the homepage document + every
// section payload shape is defined and validated. The database stores the
// document as opaque JSON (homepage.draft / .published); this module is what
// turns it into something trusted.
//
// This is a CMS migration of the CURRENT hardcoded homepage, not a redesign.
// Section data mirrors, field for field, what
// volrep-maroc/components/home/*.tsx + lib/i18n.ts (`t.home.*`) render today
// (see src/lib/homepage/defaults.ts for the 1:1 transcription).
//
// Notation used in rich-text fields (a rendering convention shared with the
// storefront renderer, NOT markdown): `\n` -> a line break. The homepage
// copy has no bold/italic notation today; `**` / `*` are treated as literal
// text by the homepage renderer.
//
// Rules mirrored from Product Studio's schema (src/lib/product-page/schema.ts):
//   - every object is .strict() (unknown keys are rejected)
//   - shapes are validated HERE, never in the DB
//   - adding a section type = one entry in HOMEPAGE_SECTION_SCHEMAS + one
//     storefront renderer + one admin editor
// ---------------------------------------------------------------------------

const richText = z.string().max(4000);
const shortText = z.string().max(400);

// A media URL held in a section slot (`kind:"url"` — a site-media asset's
// public URL, or an external URL an admin pasted in). The storefront renders
// it only as an <img>/<video> src or a <video> poster — never as a link, an
// iframe or injected markup — but the scheme is still hard-restricted here:
// only empty (placeholder) or an absolute http(s) URL. `javascript:`,
// `data:`, `blob:`, `vbscript:`, `file:` and protocol-relative `//host` are
// rejected. No server-side fetch is ever made against this value.
//
// Identical rule to Product Studio's `mediaUrl`.
const mediaUrl = z
  .string()
  .max(2000)
  .refine(
    (value) => value === "" || (/^https?:\/\/[^\s]+$/i.test(value) && isParsableHttpUrl(value)),
    "URL de média non autorisée (http(s) uniquement).",
  );

function isParsableHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// A CTA target: empty, an internal path (`/products/volrep-prm`), an in-page
// anchor (`#why-volrep-heading`), or an absolute http(s) URL. Everything the
// current homepage uses, and nothing that could carry a scheme injection.
const ctaHref = z
  .string()
  .max(400)
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("/") ||
      value.startsWith("#") ||
      /^https?:\/\/[^\s]+$/i.test(value),
    "Lien non autorisé (chemin interne « / », ancre « # » ou URL http(s)).",
  );

const cta = z.object({ label: shortText, href: ctaHref }).strict();

// ---- media slot --------------------------------------------------------
//
// One image / GIF / video position on the homepage. Same shape as Product
// Studio's `mediaSlotSchema`, with one deliberate difference: `imageId`
// here references a row in `site_media` (checked at the service layer),
// NEVER `product_images`. A homepage upload and a product gallery image
// live in separate stores and can never be confused.
//
//   - placeholder : renders the section's empty-state box
//   - image       : a site_media row id (still image or GIF)
//   - url         : a site-media public URL or an external URL; `mediaType`
//                   says whether it renders as <img>, animated <img> (gif)
//                   or <video>
export const homepageMediaSlotSchema = z
  .object({
    kind: z.enum(["placeholder", "image", "url"]).default("placeholder"),
    // Set when kind === "image": a row in site_media (checked at the
    // service layer). NEVER a product_images id.
    imageId: z.string().uuid().nullable().default(null),
    url: mediaUrl.default(""),
    poster: mediaUrl.default(""),
    alt: shortText.default(""),
    placeholderLabel: shortText.default(""),
    mediaType: z.enum(["image", "video", "gif"]).default("image"),
    fileName: shortText.default(""),
  })
  .strict();

export type HomepageMediaSlot = z.infer<typeof homepageMediaSlotSchema>;

// ---- per-section data shapes -------------------------------------------
//
// Every `eyebrow` holds ONLY the editable label token ("Récupération",
// "Boutique", "FAQ", …). The fixed "VOLREP™" / "VOLREP™ /" chrome around it
// is reproduced by the renderer exactly as today — it is not content and is
// not stored, the same way Product Studio's hero stores `subtitle` without
// its surrounding chrome.

// 1. Hero — components/home/Hero.tsx + HeroProductVisual.tsx + t.home.hero
const heroData = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    body: richText,
    primaryCta: cta,
    secondaryCta: cta,
    // The product "stage" on the right. A placeholder slot today (the
    // component renders a pure-CSS frame); a filled slot drops an image /
    // video in without a code change.
    visual: z
      .object({
        media: homepageMediaSlotSchema,
        badge: shortText, // "01"
        productName: shortText, // "VOLREP PRM™"
        caption: shortText, // "Masseur de récupération percussive"
      })
      .strict(),
  })
  .strict();

// 2. Best Sellers — components/home/BestSellers.tsx + t.home.bestSellers
const bestSellersData = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    body: richText,
    // Product selection. `catalog` = today's exact behaviour: the storefront
    // renders whatever `GET /api/products?limit=<limit>` returns, in backend
    // order. A curated-handle mode is a later addition — not V1.
    source: z
      .object({
        mode: z.enum(["catalog"]).default("catalog"),
        limit: z.number().int().min(1).max(24).default(8),
      })
      .strict()
      .default({ mode: "catalog", limit: 8 }),
  })
  .strict();

// 3. Recovery Philosophy — components/home/RecoveryPhilosophy.tsx (inline copy)
const recoveryPhilosophyData = z
  .object({
    eyebrow: shortText,
    heading: shortText, // carries a `\n`
    body: richText,
    cta: cta,
    // The athlete photograph. Today a hardcoded Shopify-CDN URL, preserved
    // verbatim as a `kind:"url"` slot; its `alt` carries the current alt text.
    background: homepageMediaSlotSchema,
  })
  .strict();

// 4. Recover Everywhere — components/home/RecoverEverywhere.tsx (inline `PAIN_POINTS`)
const recoverEverywhereData = z
  .object({
    heading: shortText, // carries a `\n`
    subtitle: richText,
    ctaLabel: shortText, // the per-card "Découvrir" link label
    ctaHref: ctaHref, // every card links here today
    zones: z
      .array(
        z
          .object({
            title: shortText,
            description: richText,
            // Today a hardcoded Shopify-CDN URL, preserved as a `kind:"url"` slot.
            media: homepageMediaSlotSchema,
            // CSS class tokens carried straight from `PAIN_POINTS` — the
            // current per-card art-direction. Kept as data because they ARE
            // today's values (task §4: "existing object position", "existing
            // grid span").
            objectPosition: shortText, // e.g. "object-right"
            span: shortText, // e.g. "lg:col-span-2"
          })
          .strict(),
      )
      .max(24),
  })
  .strict();

// 5. Why VOLREP — components/home/WhyVolrep.tsx (inline `FEATURES` / `STATS`)
const whyVolrepData = z
  .object({
    eyebrow: shortText,
    heading: shortText, // carries a `\n`
    subtitle: richText,
    features: z
      .array(
        z
          .object({
            number: shortText, // "01".."04"
            title: shortText,
            description: richText,
            // Selects one of the component's inline SVG icons. A new value
            // needs a new SVG in the renderer — a deliberate code change.
            icon: z.enum(["shield", "wave", "soundwave", "check"]),
          })
          .strict(),
      )
      .max(12),
    stats: z
      .array(
        z
          .object({
            value: z.number().int().min(0).max(1_000_000), // count-up target
            suffix: shortText, // "+", "h", "", " ans"
            label: shortText,
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

// 6. Testimonials — components/home/Testimonials.tsx (inline; static marketing
//    copy, NOT backend reviews — the homepage has never shown real reviews).
const testimonialsData = z
  .object({
    eyebrow: shortText,
    heading: shortText, // carries a `\n`
    body: richText,
    rating: z
      .object({
        stars: shortText, // "★★★★★"
        label: shortText, // "Note de 4,9/5"
        description: shortText, // "Sur la base de plus de 2 000 clients vérifiés"
      })
      .strict(),
    verifiedLabel: shortText, // "Client vérifié"
    cards: z
      .array(z.object({ name: shortText, quote: richText }).strict())
      .max(24),
    trustline: z
      .object({
        rating: shortText, // "4.9/5"
        label: shortText, // "Ils nous font confiance"
        audiences: z.array(shortText).max(12), // ["Sportifs", …]
      })
      .strict(),
    trustItems: z
      .array(z.object({ value: shortText, label: shortText }).strict())
      .max(12),
  })
  .strict();

// 7. FAQ — components/home/FAQ.tsx (inline `FAQ_ITEMS`)
const faqData = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    subtitle: richText,
    // -1 = all collapsed on load (today's behaviour: openIndex starts null).
    defaultOpen: z.number().int().min(-1).max(50).default(-1),
    items: z
      .array(z.object({ question: richText, answer: richText }).strict())
      .max(50),
  })
  .strict();

// 8. Final CTA — components/home/FinalCTA.tsx (inline)
const finalCtaData = z
  .object({
    eyebrow: shortText,
    heading: shortText, // carries a `\n`
    body: richText,
    primaryCta: cta,
    secondaryCta: cta,
    rating: z.object({ stars: shortText, label: shortText }).strict(),
    badges: z
      .array(
        z
          .object({
            icon: z.enum(["truck", "shield", "return"]),
            label: shortText,
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

// 9. Newsletter — components/home/Newsletter.tsx + t.home.newsletter.
//    The form itself stays code-owned and non-functional (no ESP wired) —
//    only its copy is content.
const newsletterData = z
  .object({
    eyebrow: shortText,
    heading: shortText, // carries a `\n`
    body: richText,
    emailLabel: shortText,
    emailPlaceholder: shortText,
    submitLabel: shortText,
    successMessage: richText,
  })
  .strict();

// ---- section registry -------------------------------------------------

export const HOMEPAGE_SECTION_SCHEMAS = {
  hero: heroData,
  bestSellers: bestSellersData,
  recoveryPhilosophy: recoveryPhilosophyData,
  recoverEverywhere: recoverEverywhereData,
  whyVolrep: whyVolrepData,
  testimonials: testimonialsData,
  faq: faqData,
  finalCta: finalCtaData,
  newsletter: newsletterData,
} as const;

export type HomepageSectionType = keyof typeof HOMEPAGE_SECTION_SCHEMAS;

export const HOMEPAGE_SECTION_TYPES = Object.keys(HOMEPAGE_SECTION_SCHEMAS) as HomepageSectionType[];

// The V1 homepage is exactly these nine sections, each present once, in any
// order. Kept as its own const so relaxing the "exactly once" rule later
// (e.g. to allow a second FAQ) is a one-line change.
export const REQUIRED_HOMEPAGE_SECTION_TYPES = HOMEPAGE_SECTION_TYPES;

export function isHomepageSectionType(value: string): value is HomepageSectionType {
  return Object.prototype.hasOwnProperty.call(HOMEPAGE_SECTION_SCHEMAS, value);
}

// Validate one section's `data` against its type (used on partial updates
// where the type is already known).
export function parseHomepageSectionData<T extends HomepageSectionType>(
  type: T,
  data: unknown,
): z.infer<(typeof HOMEPAGE_SECTION_SCHEMAS)[T]> {
  return HOMEPAGE_SECTION_SCHEMAS[type].parse(data) as z.infer<(typeof HOMEPAGE_SECTION_SCHEMAS)[T]>;
}

// One section envelope per type. Runtime union built dynamically from
// HOMEPAGE_SECTION_SCHEMAS (z.union, not z.discriminatedUnion, whose tuple
// typing can't express a mapped list); the STATIC types are hand-authored
// below so `section.type === "hero"` narrows `section.data`.
const sectionOptions = (
  Object.entries(HOMEPAGE_SECTION_SCHEMAS) as [HomepageSectionType, z.ZodTypeAny][]
).map(([type, data]) =>
  z
    .object({
      id: z.string().min(1).max(64),
      type: z.literal(type),
      enabled: z.boolean().default(true),
      data,
    })
    .strict(),
);
const sectionSchema = z.union(
  sectionOptions as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
);

export const homepageDocumentSchema = z
  .object({
    version: z.literal(1),
    settings: z.object({}).strict().default({}),
    sections: z.array(sectionSchema).max(100),
  })
  .strict()
  .superRefine((doc, ctx) => {
    // (a) section ids must be unique
    const ids = new Set<string>();
    for (const [i, s] of doc.sections.entries()) {
      if (ids.has(s.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections", i, "id"],
          message: `duplicate section id "${s.id}"`,
        });
      }
      ids.add(s.id);
    }

    // (b) the V1 section set must be represented correctly: every required
    //     type present, exactly once. (Unknown types are already rejected
    //     by the union above.)
    const typeCounts = new Map<string, number>();
    for (const s of doc.sections) typeCounts.set(s.type, (typeCounts.get(s.type) ?? 0) + 1);
    for (const required of REQUIRED_HOMEPAGE_SECTION_TYPES) {
      const count = typeCounts.get(required) ?? 0;
      if (count === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: `missing required section "${required}"`,
        });
      } else if (count > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: `section "${required}" must appear exactly once (found ${count})`,
        });
      }
    }
  });

type SectionOf<T extends HomepageSectionType> = {
  id: string;
  type: T;
  enabled: boolean;
  data: z.infer<(typeof HOMEPAGE_SECTION_SCHEMAS)[T]>;
};
export type HomepageSection = { [K in HomepageSectionType]: SectionOf<K> }[HomepageSectionType];
export type HomepageSectionData<T extends HomepageSectionType> = z.infer<
  (typeof HOMEPAGE_SECTION_SCHEMAS)[T]
>;

export type HomepageDocument = {
  version: 1;
  settings: Record<string, never>;
  sections: HomepageSection[];
};

export function parseHomepageDocument(value: unknown): HomepageDocument {
  return homepageDocumentSchema.parse(value) as unknown as HomepageDocument;
}

// ---- media-slot helpers ----------------------------------------------
//
// The sections that carry media slots, and where. Kept in one place so
// siteMediaIdsInDocument / mapDocumentMediaSlots can't drift apart.
function mediaSlotsInDocument(doc: HomepageDocument): HomepageMediaSlot[] {
  const slots: HomepageMediaSlot[] = [];
  for (const section of doc.sections) {
    if (section.type === "hero") {
      slots.push(section.data.visual.media);
    } else if (section.type === "recoveryPhilosophy") {
      slots.push(section.data.background);
    } else if (section.type === "recoverEverywhere") {
      for (const zone of section.data.zones) slots.push(zone.media);
    }
  }
  return slots;
}

// Every site_media id referenced by a `kind:"image"` slot anywhere in the
// document — used by the service layer to check every referenced asset
// exists in site_media (and, by construction, is NOT a product_images id),
// and to null stale references when a site_media row is deleted.
export function siteMediaIdsInDocument(doc: HomepageDocument): string[] {
  const ids: string[] = [];
  for (const slot of mediaSlotsInDocument(doc)) {
    if (slot.kind === "image" && slot.imageId) ids.push(slot.imageId);
  }
  return [...new Set(ids)];
}

// Return a new document with `fn` applied to every media slot. Used to
// resolve `kind:"image"` slots to URLs on the storefront read, and to null
// stale references when a site_media row is deleted.
export function mapDocumentMediaSlots(
  doc: HomepageDocument,
  fn: (slot: HomepageMediaSlot) => HomepageMediaSlot,
): HomepageDocument {
  const sections = doc.sections.map((section): HomepageSection => {
    if (section.type === "hero") {
      return {
        ...section,
        data: { ...section.data, visual: { ...section.data.visual, media: fn(section.data.visual.media) } },
      };
    }
    if (section.type === "recoveryPhilosophy") {
      return { ...section, data: { ...section.data, background: fn(section.data.background) } };
    }
    if (section.type === "recoverEverywhere") {
      return {
        ...section,
        data: {
          ...section.data,
          zones: section.data.zones.map((zone) => ({ ...zone, media: fn(zone.media) })),
        },
      };
    }
    return section;
  });
  return { ...doc, sections };
}
