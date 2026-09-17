// Storefront-side mirror of the backend Homepage Studio document
// (volrep-backend/src/lib/homepage/schema.ts). The backend is the
// authority — this file only needs to describe the JSON the storefront
// receives from GET /api/homepage so HomepageRenderer + the section
// components are typed.
//
// `MediaSlot` is reused from the Product Studio mirror: the backend's
// `homepageMediaSlotSchema` is byte-for-byte the same shape as its
// `mediaSlotSchema` (kind/imageId/url/poster/alt/placeholderLabel/
// mediaType/fileName) — one contract, no duplicate type.
import type { MediaSlot } from "@/lib/product-page/types";

export type HomepageMediaSlot = MediaSlot;

export type Cta = { label: string; href: string };

// 1. Hero
export type HeroSectionData = {
  eyebrow: string;
  heading: string;
  body: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  visual: {
    media: HomepageMediaSlot;
    badge: string;
    productName: string;
    caption: string;
  };
};

// 2. Best Sellers
export type BestSellersSectionData = {
  eyebrow: string;
  heading: string;
  body: string;
  source: { mode: "catalog"; limit: number };
};

// 3. Recovery Philosophy
export type RecoveryPhilosophySectionData = {
  eyebrow: string;
  heading: string; // may carry a "\n"
  body: string;
  cta: Cta;
  background: HomepageMediaSlot;
};

// 4. Recover Everywhere
export type RecoverEverywhereZone = {
  title: string;
  description: string;
  media: HomepageMediaSlot;
  objectPosition: string;
  span: string;
};
export type RecoverEverywhereSectionData = {
  heading: string; // may carry a "\n"
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  zones: RecoverEverywhereZone[];
};

// 5. Why VOLREP
export type WhyVolrepIcon = "shield" | "wave" | "soundwave" | "check";
export type WhyVolrepFeature = {
  number: string;
  title: string;
  description: string;
  icon: WhyVolrepIcon;
};
export type WhyVolrepStat = { value: number; suffix: string; label: string };
export type WhyVolrepSectionData = {
  eyebrow: string;
  heading: string; // may carry a "\n"
  subtitle: string;
  features: WhyVolrepFeature[];
  stats: WhyVolrepStat[];
};

// 6. Testimonials
export type TestimonialCard = { name: string; quote: string };
export type TestimonialsSectionData = {
  eyebrow: string;
  heading: string; // may carry a "\n"
  body: string;
  rating: { stars: string; label: string; description: string };
  verifiedLabel: string;
  cards: TestimonialCard[];
  trustline: { rating: string; label: string; audiences: string[] };
  trustItems: { value: string; label: string }[];
};

// 7. FAQ
export type FaqItemData = { question: string; answer: string };
export type FaqSectionData = {
  eyebrow: string;
  heading: string;
  subtitle: string;
  defaultOpen: number; // -1 = all collapsed on load
  items: FaqItemData[];
};

// 8. Final CTA
export type FinalCtaIcon = "truck" | "shield" | "return";
export type FinalCtaBadge = { icon: FinalCtaIcon; label: string };
export type FinalCtaSectionData = {
  eyebrow: string;
  heading: string; // may carry a "\n"
  body: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  rating: { stars: string; label: string };
  badges: FinalCtaBadge[];
};

// 9. Newsletter
export type NewsletterSectionData = {
  eyebrow: string;
  heading: string; // may carry a "\n"
  body: string;
  emailLabel: string;
  emailPlaceholder: string;
  submitLabel: string;
  successMessage: string;
};

export type HomepageSection =
  | { id: string; type: "hero"; enabled: boolean; data: HeroSectionData }
  | { id: string; type: "bestSellers"; enabled: boolean; data: BestSellersSectionData }
  | { id: string; type: "recoveryPhilosophy"; enabled: boolean; data: RecoveryPhilosophySectionData }
  | { id: string; type: "recoverEverywhere"; enabled: boolean; data: RecoverEverywhereSectionData }
  | { id: string; type: "whyVolrep"; enabled: boolean; data: WhyVolrepSectionData }
  | { id: string; type: "testimonials"; enabled: boolean; data: TestimonialsSectionData }
  | { id: string; type: "faq"; enabled: boolean; data: FaqSectionData }
  | { id: string; type: "finalCta"; enabled: boolean; data: FinalCtaSectionData }
  | { id: string; type: "newsletter"; enabled: boolean; data: NewsletterSectionData };

export type HomepageSectionType = HomepageSection["type"];

export type HomepageDocument = {
  version: 1;
  settings: Record<string, never>;
  sections: HomepageSection[];
};

const SECTION_TYPES: ReadonlySet<string> = new Set<HomepageSectionType>([
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

// Structural guard for the value the backend returns. It does NOT validate
// every field (the backend's zod already did that on write / publish) — it
// only confirms the envelope is recognisable, so a malformed response falls
// back to the code-owned default document instead of throwing mid-render.
export function isHomepageDocument(value: unknown): value is HomepageDocument {
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
