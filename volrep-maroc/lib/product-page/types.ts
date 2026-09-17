// Storefront-side mirror of the backend "Page produit" document
// (volrep-backend/src/lib/product-page/schema.ts). The backend is the
// authority — this file only needs to describe the JSON the storefront
// receives from GET /api/products/:handle/page so the renderer is typed.
//
// Text-field notation (a rendering convention, NOT markdown — see
// components/product-landing/rich-text.tsx): `**bold**` -> <strong>,
// `*italic*` -> <em>, `\n` -> <br>.

export type RichText = string;

export type MediaSlot = {
  kind: "placeholder" | "image" | "url";
  imageId: string | null;
  url: string;
  poster: string;
  alt: string;
  placeholderLabel: string;
  // "video" when a kind:"url" slot points at an MP4, "gif" when it points at
  // an animated GIF (UGC "Vidéos clients" cards). Absent / "image" everywhere
  // else. Backend-defaulted, so optional on the wire.
  mediaType?: "image" | "video" | "gif";
  fileName?: string;
};

export type HeroData = {
  subtitle: string;
  reviewsFallbackLabel: string;
  reviewsCountSuffix: string;
  features: { icon: string; label: string }[];
  ctaLabel: string;
  ctaSubtext: string;
  ctaSubtextSmall: string;
  guarantees: { icon: string; text: string }[];
  guaranteeBox: { icon: string; title: string; body: RichText };
  description: RichText[];
  beforeAfter: {
    enabled: boolean;
    title: string;
    subtitle: string;
    beforeLabel: string;
    afterLabel: string;
    zones: { name: string; media: MediaSlot }[];
    disclaimer: RichText;
  };
};

export type AccordionData = {
  heading: string;
  defaultOpen: number;
  items: { question: RichText; answer: RichText }[];
};

export type UgcData = { heading: string; videos: { media: MediaSlot }[] };
export type ProfessionalsData = { title: string; labels: string[] };
export type BigResultData = { heading: string; media: MediaSlot; disclaimer: RichText };

export type BenefitsData = {
  media: MediaSlot;
  heading: string;
  subtitle: RichText;
  blocks: { title: string; desc: RichText; tags: string[] }[];
};

export type SayGoodbyeData = { media: MediaSlot; title: string; items: string[]; desc: RichText };

export type EndorsementData = {
  avatar: string;
  quote: RichText;
  name: RichText;
  title: string;
  desc: RichText;
  proTip: { badge: string; text: RichText };
};

export type CompState = "yes" | "no" | "partial";
export type ComparisonData = {
  heading: string;
  subtitle: string;
  productName: string;
  // Product visual above the table. Empty / absent placeholder slot => fall
  // back to the product's featured/first gallery image (unchanged
  // behaviour); a filled slot overrides it.
  media?: MediaSlot;
  competitors: string[];
  rows: { label: string; product: CompState; competitors: CompState[] }[];
};

export type ReviewsData = { heading: string; maxCount: number; emptyText: RichText };
export type TrustData = { items: { icon: string; title: string; desc: string }[] };

export type ProblemSolutionData = {
  warningIcon: string;
  warningText: string;
  title: string;
  problems: { icon: string; title: string; text: RichText }[];
  solutionLabel: string;
  solution: { icon: string; title: string; text: RichText };
};

export type OrderData = { title: string; subtitle: string };
export type StickyCtaData = { label: string };

export type PageSection =
  | { id: string; type: "hero"; enabled: boolean; data: HeroData }
  | { id: string; type: "ugc"; enabled: boolean; data: UgcData }
  | { id: string; type: "descriptionFaq"; enabled: boolean; data: AccordionData }
  | { id: string; type: "professionals"; enabled: boolean; data: ProfessionalsData }
  | { id: string; type: "bigResult"; enabled: boolean; data: BigResultData }
  | { id: string; type: "benefits"; enabled: boolean; data: BenefitsData }
  | { id: string; type: "sayGoodbye"; enabled: boolean; data: SayGoodbyeData }
  | { id: string; type: "endorsement"; enabled: boolean; data: EndorsementData }
  | { id: string; type: "comparison"; enabled: boolean; data: ComparisonData }
  | { id: string; type: "reviews"; enabled: boolean; data: ReviewsData }
  | { id: string; type: "trust"; enabled: boolean; data: TrustData }
  | { id: string; type: "faq"; enabled: boolean; data: AccordionData }
  | { id: string; type: "problemSolution"; enabled: boolean; data: ProblemSolutionData }
  | { id: string; type: "order"; enabled: boolean; data: OrderData }
  | { id: string; type: "stickyCta"; enabled: boolean; data: StickyCtaData };

export type SectionType = PageSection["type"];

export type PageDocument = {
  version: 1;
  settings: Record<string, never>;
  sections: PageSection[];
};

const SECTION_TYPES: ReadonlySet<string> = new Set<SectionType>([
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
]);

// Structural guard for the value the backend returns. It does NOT validate
// every field (the backend's zod already did that on write / publish) — it
// only confirms the envelope is recognisable, so a malformed response falls
// back to the code-owned default document instead of throwing mid-render.
export function isPageDocument(value: unknown): value is PageDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as { version?: unknown; sections?: unknown };
  if (doc.version !== 1) return false;
  if (!Array.isArray(doc.sections)) return false;
  return doc.sections.every((section) => {
    if (!section || typeof section !== "object") return false;
    const s = section as { id?: unknown; type?: unknown; enabled?: unknown; data?: unknown };
    return (
      typeof s.id === "string" &&
      typeof s.enabled === "boolean" &&
      typeof s.type === "string" &&
      SECTION_TYPES.has(s.type) &&
      !!s.data &&
      typeof s.data === "object"
    );
  });
}
