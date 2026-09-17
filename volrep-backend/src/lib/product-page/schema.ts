import { z } from "zod";

// ---------------------------------------------------------------------------
// Product Studio "Page produit" — the ONE place the page document + every
// section payload shape is defined and validated. The database stores the
// document as opaque JSON (product_pages.draft / .published); this module is
// what turns it into something trusted.
//
// Notation used in text fields (a rendering convention shared with the
// storefront renderer, NOT markdown): `**bold**` -> <strong>, `*italic*` ->
// <em> (serif accent face), `\n` -> <br>. Literal `*` never appears in the
// migrated content.
//
// Rules mirrored from the retired 7C-3 content-blocks model:
//   - every object is .strict() (unknown keys are rejected)
//   - shapes are validated HERE, never in the DB
//   - adding a section type = one entry in SECTION_SCHEMAS + one storefront
//     renderer + one admin editor
// ---------------------------------------------------------------------------

/** A single editorial paragraph / label / heading. May carry the inline
 *  emphasis + line-break notation above. */
const richText = z.string().max(4000);
const shortText = z.string().max(400);
const glyph = z.string().max(16); // an emoji or a 1-2 char symbol

// A media URL held in a section slot (`kind:"url"` — an uploaded asset's
// public URL, or an external URL an admin pasted in the Studio's "URL
// externe" tab). The storefront renders it only as an <img>/<video> src or
// a <video> poster — never as a link, an iframe or injected markup — but we
// still hard-restrict the scheme here: only empty (placeholder) or an
// absolute http(s) URL. `javascript:`, `data:`, `blob:`, `vbscript:`,
// `file:` and protocol-relative `//host` are rejected (security hardening —
// Step 3 §10/§11). No server-side fetch is ever made against this value.
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

/** An image / GIF / video position. A slot is one of:
 *   - placeholder : renders the `.lp-ph` "visuel à venir" box
 *   - image       : an uploaded product_images row belonging to THIS product
 *                   (checked at the service layer) — always a still image
 *   - url         : a section-scoped uploaded asset (image, animated GIF or
 *                   MP4) or an external URL. `mediaType` says which; the
 *                   physical file for an uploaded asset is content-addressed
 *                   and shared, never added to the product gallery.
 *  UGC ("Vidéos clients") cards fill their slot with a `url` + mediaType
 *  "video" (MP4 -> <video>) or "gif" (animated GIF -> <img>); when empty
 *  they render the placeholder. A GIF is served verbatim as image/gif —
 *  never flattened to a still frame. */
export const mediaSlotSchema = z
  .object({
    kind: z.enum(["placeholder", "image", "url"]).default("placeholder"),
    // Set when kind === "image": a row in product_images belonging to THIS
    // product (checked at the service layer).
    imageId: z.string().uuid().nullable().default(null),
    // Set when kind === "url": an uploaded-asset or external image/gif/mp4
    // URL. Scheme-restricted to empty or http(s) — see `mediaUrl`.
    url: mediaUrl.default(""),
    // Optional poster frame for a video URL — same restriction.
    poster: mediaUrl.default(""),
    alt: shortText.default(""),
    // Text shown inside the `.lp-ph` box while the slot is empty.
    placeholderLabel: shortText.default(""),
    // How a filled slot renders. "image" for every legacy slot and every
    // kind:"image" slot; "video" when a kind:"url" slot points at an MP4;
    // "gif" when it points at an animated GIF (still rendered with <img>,
    // never transcoded). Defaulted so pre-existing documents parse unchanged.
    mediaType: z.enum(["image", "video", "gif"]).default("image"),
    // Original upload filename, shown in the Studio under the preview
    // ("UGC_01.mp4"). Display-only; never used to fetch anything.
    fileName: shortText.default(""),
  })
  .strict();

const compState = z.enum(["yes", "no", "partial"]);

// ---- per-section data shapes ---------------------------------------------

const heroData = z
  .object({
    subtitle: shortText,
    reviewsFallbackLabel: shortText,
    reviewsCountSuffix: shortText,
    features: z.array(z.object({ icon: glyph, label: shortText }).strict()).max(12),
    ctaLabel: shortText, // "{price}" is substituted with the live formatted price
    ctaSubtext: shortText,
    ctaSubtextSmall: shortText, // also supports "{price}"
    guarantees: z.array(z.object({ icon: glyph, text: shortText }).strict()).max(12),
    guaranteeBox: z.object({ icon: glyph, title: shortText, body: richText }).strict(),
    description: z.array(richText).max(12), // paragraphs
    beforeAfter: z
      .object({
        // The before/after grid is physically inside the hero <section> (shared
        // gradient background); it is independently hideable but not
        // independently reorderable in V1.
        enabled: z.boolean().default(true),
        title: shortText,
        subtitle: shortText,
        beforeLabel: shortText,
        afterLabel: shortText,
        zones: z
          .array(z.object({ name: shortText, media: mediaSlotSchema }).strict())
          .max(12),
        disclaimer: richText,
      })
      .strict(),
  })
  .strict();

const accordionData = z
  .object({
    // "" for the mini "Description" accordion (no heading), a real heading for
    // the full FAQ section.
    heading: shortText.default(""),
    defaultOpen: z.number().int().min(-1).max(50).default(0),
    items: z.array(z.object({ question: richText, answer: richText }).strict()).max(50),
  })
  .strict();

const ugcData = z
  .object({
    heading: shortText,
    videos: z.array(z.object({ media: mediaSlotSchema }).strict()).max(24),
  })
  .strict();

const professionalsData = z
  .object({ title: shortText, labels: z.array(shortText).max(24) })
  .strict();

const bigResultData = z
  .object({ heading: shortText, media: mediaSlotSchema, disclaimer: richText })
  .strict();

const benefitsData = z
  .object({
    media: mediaSlotSchema,
    heading: shortText,
    subtitle: richText,
    blocks: z
      .array(
        z
          .object({ title: shortText, desc: richText, tags: z.array(shortText).max(12) })
          .strict(),
      )
      .max(24),
  })
  .strict();

const sayGoodbyeData = z
  .object({
    media: mediaSlotSchema,
    title: shortText,
    items: z.array(shortText).max(12),
    desc: richText,
  })
  .strict();

const endorsementData = z
  .object({
    avatar: glyph,
    quote: richText,
    name: richText,
    title: shortText,
    desc: richText,
    proTip: z.object({ badge: shortText, text: richText }).strict(),
  })
  .strict();

const comparisonData = z
  .object({
    heading: shortText,
    subtitle: shortText,
    productName: shortText,
    // The product visual shown above the table. An unfilled placeholder
    // slot means "fall back to the product's featured/first gallery image"
    // (the pre-Studio behaviour); a filled slot overrides it. Defaulted so
    // documents published before this field existed still parse.
    media: mediaSlotSchema.default({}),
    competitors: z.array(shortText).min(1).max(6),
    rows: z
      .array(
        z
          .object({
            label: shortText,
            product: compState,
            competitors: z.array(compState).min(1).max(6),
          })
          .strict(),
      )
      .max(50),
  })
  .strict()
  .superRefine((val, ctx) => {
    for (const [i, row] of val.rows.entries()) {
      if (row.competitors.length !== val.competitors.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows", i, "competitors"],
          message: `row must have exactly ${val.competitors.length} competitor cells`,
        });
      }
    }
  });

const reviewsData = z
  .object({
    heading: shortText,
    // Display-only: how many REAL reviews (from GET /api/reviews/:handle) to
    // show. Review content itself is never authored here.
    maxCount: z.number().int().min(1).max(24).default(6),
    emptyText: richText,
  })
  .strict();

const trustData = z
  .object({
    items: z
      .array(z.object({ icon: glyph, title: shortText, desc: shortText }).strict())
      .max(24),
  })
  .strict();

const problemSolutionData = z
  .object({
    warningIcon: glyph,
    warningText: shortText,
    title: shortText,
    problems: z
      .array(z.object({ icon: glyph, title: shortText, text: richText }).strict())
      .max(12),
    solutionLabel: shortText,
    solution: z.object({ icon: glyph, title: shortText, text: richText }).strict(),
  })
  .strict();

// The order section: only the copy ABOVE the COD form. The form itself
// (LpOrderForm) and all its internal copy stay code-owned so checkout logic
// is never touched (task §15).
const orderData = z.object({ title: shortText, subtitle: shortText }).strict();

const stickyCtaData = z.object({ label: shortText }).strict();

// ---- section registry ---------------------------------------------------

export const SECTION_SCHEMAS = {
  hero: heroData,
  ugc: ugcData,
  descriptionFaq: accordionData,
  professionals: professionalsData,
  bigResult: bigResultData,
  benefits: benefitsData,
  sayGoodbye: sayGoodbyeData,
  endorsement: endorsementData,
  comparison: comparisonData,
  reviews: reviewsData,
  trust: trustData,
  faq: accordionData,
  problemSolution: problemSolutionData,
  order: orderData,
  stickyCta: stickyCtaData,
} as const;

export type SectionType = keyof typeof SECTION_SCHEMAS;

export const SECTION_TYPES = Object.keys(SECTION_SCHEMAS) as SectionType[];

export function isSectionType(value: string): value is SectionType {
  return Object.prototype.hasOwnProperty.call(SECTION_SCHEMAS, value);
}

// Validate one section's `data` against its type (used on partial updates
// where the type is already known from the stored row).
export function parseSectionData<T extends SectionType>(
  type: T,
  data: unknown,
): z.infer<(typeof SECTION_SCHEMAS)[T]> {
  return SECTION_SCHEMAS[type].parse(data) as z.infer<(typeof SECTION_SCHEMAS)[T]>;
}

// One section envelope per type. The runtime union is built dynamically
// from SECTION_SCHEMAS (z.union, not z.discriminatedUnion, whose tuple
// typing can't express a mapped list); the STATIC types are hand-authored
// just below so `section.type === "hero"` narrows `section.data` correctly.
const sectionOptions = (Object.entries(SECTION_SCHEMAS) as [SectionType, z.ZodTypeAny][]).map(
  ([type, data]) =>
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

export const pageDocumentSchema = z
  .object({
    version: z.literal(1),
    settings: z.object({}).strict().default({}),
    sections: z.array(sectionSchema).max(100),
  })
  .strict()
  .superRefine((doc, ctx) => {
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
  });

export type MediaSlot = z.infer<typeof mediaSlotSchema>;

type SectionOf<T extends SectionType> = {
  id: string;
  type: T;
  enabled: boolean;
  data: z.infer<(typeof SECTION_SCHEMAS)[T]>;
};
export type PageSection = { [K in SectionType]: SectionOf<K> }[SectionType];
export type SectionData<T extends SectionType> = z.infer<(typeof SECTION_SCHEMAS)[T]>;

export type PageDocument = {
  version: 1;
  settings: Record<string, never>;
  sections: PageSection[];
};

export function parsePageDocument(value: unknown): PageDocument {
  // Runtime-validated by pageDocumentSchema; the static shape is the
  // hand-authored discriminated union above (the dynamic z.union erases to
  // `any` at the type level).
  return pageDocumentSchema.parse(value) as unknown as PageDocument;
}

// The sections that carry media slots, and where. Kept in one place so
// imageIdsInDocument / mapDocumentMediaSlots can't drift apart.
type SlottedSection = Extract<
  PageSection,
  { type: "hero" | "ugc" | "bigResult" | "benefits" | "sayGoodbye" | "comparison" }
>;

function isSlotted(section: PageSection): section is SlottedSection {
  return (
    section.type === "hero" ||
    section.type === "ugc" ||
    section.type === "bigResult" ||
    section.type === "benefits" ||
    section.type === "sayGoodbye" ||
    section.type === "comparison"
  );
}

// All product-image ids referenced by media slots anywhere in the document —
// used by the service layer to check every referenced image belongs to the
// product, and to null stale references when an image is deleted.
export function imageIdsInDocument(doc: PageDocument): string[] {
  const ids: string[] = [];
  for (const slot of mediaSlotsInDocument(doc)) {
    if (slot.kind === "image" && slot.imageId) ids.push(slot.imageId);
  }
  return [...new Set(ids)];
}

function mediaSlotsInDocument(doc: PageDocument): MediaSlot[] {
  const slots: MediaSlot[] = [];
  for (const section of doc.sections) {
    if (!isSlotted(section)) continue;
    if (section.type === "hero") {
      for (const zone of section.data.beforeAfter.zones) slots.push(zone.media);
    } else if (section.type === "ugc") {
      for (const video of section.data.videos) slots.push(video.media);
    } else {
      slots.push(section.data.media);
    }
  }
  return slots;
}

// Return a new document with `fn` applied to every media slot. Used to null
// stale image references when a product image is deleted (media.ts).
export function mapDocumentMediaSlots(
  doc: PageDocument,
  fn: (slot: MediaSlot) => MediaSlot,
): PageDocument {
  const sections = doc.sections.map((section): PageSection => {
    if (section.type === "hero") {
      return {
        ...section,
        data: {
          ...section.data,
          beforeAfter: {
            ...section.data.beforeAfter,
            zones: section.data.beforeAfter.zones.map((zone) => ({ ...zone, media: fn(zone.media) })),
          },
        },
      };
    }
    if (section.type === "ugc") {
      return {
        ...section,
        data: { ...section.data, videos: section.data.videos.map((video) => ({ ...video, media: fn(video.media) })) },
      };
    }
    if (section.type === "bigResult") {
      return { ...section, data: { ...section.data, media: fn(section.data.media) } };
    }
    if (section.type === "benefits") {
      return { ...section, data: { ...section.data, media: fn(section.data.media) } };
    }
    if (section.type === "sayGoodbye") {
      return { ...section, data: { ...section.data, media: fn(section.data.media) } };
    }
    if (section.type === "comparison") {
      return { ...section, data: { ...section.data, media: fn(section.data.media) } };
    }
    return section;
  });
  return { ...doc, sections };
}
