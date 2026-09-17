// Response shapes returned by the Volrep backend admin API. Hand-mirrored
// from src/mappers/admin.ts in volrep-backend — kept deliberately narrow
// (only what the UI reads).

export type Money = { amount: string; currencyCode: string };
export type Role = "owner" | "staff";

export type AdminMe = {
  id: string;
  email: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
};

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "fulfilled"
  | "partially_fulfilled"
  | "canceled"
  | "refunded"
  | "partially_refunded";

export type PaymentStatus = "pending" | "paid" | "refunded";

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  email: string;
  phone: string;
  total: Money;
  currency: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Fulfillment = {
  id: string;
  status: "unfulfilled" | "fulfilled";
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  allowedTransitions: OrderStatus[];
  paymentStatus: PaymentStatus;
  customer: { email: string; phone: string };
  shippingAddress: Record<string, unknown>;
  payment: { provider: string; reference: string | null; paidAt: string | null };
  amounts: { subtotal: Money; shipping: Money; discount: Money; total: Money; currency: string };
  lineItems: {
    id: string;
    variantId: string | null;
    productTitle: string;
    variantTitle: string;
    sku: string | null;
    quantity: number;
    unitPrice: Money;
    lineTotal: Money;
  }[];
  fulfillment: Fulfillment | null;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<K extends string, T> = { total: number; limit: number; offset: number } & Record<K, T[]>;

export type ProductStatus = "draft" | "active" | "archived";

export type ProductSummary = {
  id: string;
  handle: string;
  title: string;
  status: ProductStatus;
  productType: string;
  tags: string[];
  variantCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Variant = {
  id: string;
  productId: string;
  sku: string | null;
  title: string;
  selectedOptions: { name: string; value: string }[];
  price: Money;
  compareAtPrice: Money | null;
  currency: string;
  stock: number;
  availableForSale: boolean;
  imageId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductImage = {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  position: number;
  // Phase 7C-2: `owned` = uploaded through the Volrep media pipeline (vs a
  // legacy external URL like cdn.shopify.com). An admin cannot flip this.
  owned: boolean;
  contentType: string | null;
  byteSize: number | null;
};

export type ProductOption = { id: string; name: string; values: string[]; position: number };

// Structured product content. Only `subtitle` (accroche) remains a
// Product Studio field — richer marketing content (copy, benefits, SEO)
// lives in Lirya. Mirrors mapAdminProductDetail.content in volrep-backend.
export type ProductContent = {
  subtitle: string;
};

export type ProductDetail = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: ProductStatus;
  productType: string;
  tags: string[];
  content: ProductContent;
  images: ProductImage[];
  options: ProductOption[];
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
};

// ---- Product Studio -------------------------------------------------
// Mirrors src/mappers/admin.ts (mapProductStudio / mapLandingPage /
// computeStudioCompleteness) in volrep-backend. Product Studio owns the
// product and its Lirya binding; landing-page CONTENT lives in Lirya.

// ---- Lirya landing-page binding (V1 integration, READ-ONLY) ----------
// Volrep owns the Product ↔ Landing Page binding; Lirya owns the page.
// This is the binding + a disposable cache of display fields + three
// server-derived fields (`verified`, `previewUrl`, `editorUrl`). Mirrors
// mapLandingPage() in volrep-backend/src/mappers/admin.ts.

export type LiryaCachedStatus = "published" | "hidden" | "draft";

// A product can hold at most one Lirya page per role (UNIQUE(product_id,
// role) in volrep-backend). The column is free text; these are the
// conventional values the admin UI offers.
export type LandingPageRole = "primary" | "campaign" | "ab_variant" | "locale";

// Stable sync-error codes the backend records after a failed Lirya check.
export type LandingPageSyncError =
  | "page_not_found"
  | "unauthorized"
  | "insufficient_scope"
  | "rate_limited"
  | "unavailable";

export type LandingPageBinding = {
  id: string;
  liryaPageId: string;
  role: string;
  cachedStatus: string | null;
  name: string | null;
  slug: string | null;
  template: string | null;
  version: string | null;
  publicUrl: string | null;
  // The public URL, but ONLY when the page is published — null otherwise
  // so the UI disables Preview for hidden / draft pages.
  previewUrl: string | null;
  // Outbound legacy-editor link, built server-side; null when not
  // available (no admin base URL, or an API-created structured draft).
  editorUrl: string | null;
  // The integrity check: does Lirya's external_ref point back at this product?
  verified: boolean;
  externalRefProductId: string | null;
  syncError: LandingPageSyncError | string | null;
  lastSyncedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// One row in the Lirya page picker (GET /api/admin/lirya/pages).
export type LiryaPageSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  template: string | null;
  url: string | null;
  // Lirya `updated_at` (ISO-8601) — shown in the association picker.
  updatedAt: string | null;
};

// The backend still computes `content`/`hero`/`seo` (dormant structures,
// pending a later DB cleanup); Product Studio no longer surfaces them, so
// they are intentionally omitted here.
export type StudioCompleteness = {
  media: { total: number; owned: number; ready: boolean };
  landingPages: { total: number; linked: number; verified: number; needsAttention: boolean };
  commerce: { variants: number; priced: boolean; published: boolean };
};

export type ProductStudio = {
  product: ProductDetail;
  // Cache-only in the studio payload — the Pages marketing tab refreshes
  // from Lirya through its own endpoint.
  landingPages: LandingPageBinding[];
  completeness: StudioCompleteness;
};

// GET /api/admin/products/:id/landing-pages
export type LandingPagesResponse = {
  landingPages: LandingPageBinding[];
  liryaConfigured: boolean;
};

// ---- Product Studio "Page produit" -------------------------------------
// Mirrors volrep-backend/src/lib/product-page/schema.ts and the storefront
// copy (volrep-maroc/lib/product-page/types.ts). The backend zod is the
// authority; this describes the JSON the admin edits and posts back.
//
// Text-field notation (a storefront rendering convention, NOT markdown):
//   **bold** -> <strong>, *italic* -> <em>, \n -> <br>.

export type PageMediaSlot = {
  kind: "placeholder" | "image" | "url";
  imageId: string | null;
  url: string;
  poster: string;
  alt: string;
  placeholderLabel: string;
  // How a filled slot renders. Absent / "image" for every legacy slot;
  // "video" when a kind:"url" slot points at an MP4, "gif" when it points at
  // an animated GIF (UGC cards). The backend zod defaults this, so it is
  // optional on the wire.
  mediaType?: "image" | "video" | "gif";
  // Original upload filename, shown under the Studio preview. Display-only.
  fileName?: string;
};

export type PageHeroData = {
  subtitle: string;
  reviewsFallbackLabel: string;
  reviewsCountSuffix: string;
  features: { icon: string; label: string }[];
  ctaLabel: string;
  ctaSubtext: string;
  ctaSubtextSmall: string;
  guarantees: { icon: string; text: string }[];
  guaranteeBox: { icon: string; title: string; body: string };
  description: string[];
  beforeAfter: {
    enabled: boolean;
    title: string;
    subtitle: string;
    beforeLabel: string;
    afterLabel: string;
    zones: { name: string; media: PageMediaSlot }[];
    disclaimer: string;
  };
};

export type PageAccordionData = {
  heading: string;
  defaultOpen: number;
  items: { question: string; answer: string }[];
};

export type PageUgcData = { heading: string; videos: { media: PageMediaSlot }[] };
export type PageProfessionalsData = { title: string; labels: string[] };
export type PageBigResultData = { heading: string; media: PageMediaSlot; disclaimer: string };
export type PageBenefitsData = {
  media: PageMediaSlot;
  heading: string;
  subtitle: string;
  blocks: { title: string; desc: string; tags: string[] }[];
};
export type PageSayGoodbyeData = {
  media: PageMediaSlot;
  title: string;
  items: string[];
  desc: string;
};
export type PageEndorsementData = {
  avatar: string;
  quote: string;
  name: string;
  title: string;
  desc: string;
  proTip: { badge: string; text: string };
};
export type PageCompState = "yes" | "no" | "partial";
export type PageComparisonData = {
  heading: string;
  subtitle: string;
  productName: string;
  // Product visual above the table. An empty placeholder slot = fall back
  // to the product's featured/first gallery image (unchanged storefront
  // behaviour); a filled slot overrides it. Backend-defaulted, optional
  // on the wire for documents saved before this field existed.
  media?: PageMediaSlot;
  competitors: string[];
  rows: { label: string; product: PageCompState; competitors: PageCompState[] }[];
};
export type PageReviewsData = { heading: string; maxCount: number; emptyText: string };
export type PageTrustData = { items: { icon: string; title: string; desc: string }[] };
export type PageProblemSolutionData = {
  warningIcon: string;
  warningText: string;
  title: string;
  problems: { icon: string; title: string; text: string }[];
  solutionLabel: string;
  solution: { icon: string; title: string; text: string };
};
export type PageOrderData = { title: string; subtitle: string };
export type PageStickyCtaData = { label: string };

export type PageSection =
  | { id: string; type: "hero"; enabled: boolean; data: PageHeroData }
  | { id: string; type: "ugc"; enabled: boolean; data: PageUgcData }
  | { id: string; type: "descriptionFaq"; enabled: boolean; data: PageAccordionData }
  | { id: string; type: "professionals"; enabled: boolean; data: PageProfessionalsData }
  | { id: string; type: "bigResult"; enabled: boolean; data: PageBigResultData }
  | { id: string; type: "benefits"; enabled: boolean; data: PageBenefitsData }
  | { id: string; type: "sayGoodbye"; enabled: boolean; data: PageSayGoodbyeData }
  | { id: string; type: "endorsement"; enabled: boolean; data: PageEndorsementData }
  | { id: string; type: "comparison"; enabled: boolean; data: PageComparisonData }
  | { id: string; type: "reviews"; enabled: boolean; data: PageReviewsData }
  | { id: string; type: "trust"; enabled: boolean; data: PageTrustData }
  | { id: string; type: "faq"; enabled: boolean; data: PageAccordionData }
  | { id: string; type: "problemSolution"; enabled: boolean; data: PageProblemSolutionData }
  | { id: string; type: "order"; enabled: boolean; data: PageOrderData }
  | { id: string; type: "stickyCta"; enabled: boolean; data: PageStickyCtaData };

export type PageSectionType = PageSection["type"];

export type PageDocument = {
  version: 1;
  settings: Record<string, never>;
  sections: PageSection[];
};

// GET/PUT /api/admin/products/:id/page  (mapProductPageAdmin)
export type ProductPageResponse = {
  draft: PageDocument;
  draftValid: boolean;
  published: PageDocument | null;
  publishedValid: boolean | null;
  hasPublished: boolean;
  draftMatchesPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

// POST /api/admin/products/:id/page/preview-token
export type PagePreviewToken = { token: string; expiresAt: string; handle: string };

// GET /api/admin/lirya/pages
export type LiryaPagesResponse = {
  pages: LiryaPageSummary[];
  nextCursor: string | null;
  liryaConfigured: boolean;
};

export type InventoryHistoryEntry = {
  id: string;
  adminUserId: string | null;
  mode?: string;
  previousQuantity?: number;
  newQuantity?: number;
  delta?: number;
  reason?: string;
  createdAt: string;
};

export type ReviewStatus = "pending" | "approved" | "rejected";

export type AdminReview = {
  id: string;
  productId: string;
  orderId: string | null;
  author: string;
  email: string | null;
  rating: number;
  body: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShippingCountry = {
  id: string;
  countryCode: string;
  active: boolean;
  flatRate: Money;
  currency: string;
  handlingTimeDays: { min: number; max: number };
  shippingTimeDays: { min: number; max: number };
  returnWindowDays: number;
  returnShippingFree: boolean;
  refundProcessingDays: number;
};

// Store identity Volrep owns as source of truth. No secret is ever part
// of this payload.
export type StoreSettings = {
  storeName: string;
  tagline: string;
  supportEmail: string;
  social: { instagram: string; tiktok: string; youtube: string };
  updatedAt: string;
};

// Read-only view of external systems. The Lirya API key is never sent —
// only `apiKeyPresent` + a masked `apiKeyHint`.
export type IntegrationsStatus = {
  lirya: {
    configured: boolean;
    apiBaseUrl: string | null;
    apiKeyPresent: boolean;
    apiKeyHint: string | null;
    adminBaseUrl: string | null;
    timeoutMs: number;
  };
  cod: { status: "not_connected" };
};

export type LiryaTestResult =
  | { ok: true; pageCount: number; message: string }
  | { ok: false; code: string; message: string };

export type AuditEntry = {
  id: string;
  adminUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
};

export type AnalyticsPeriod = "7d" | "30d" | "all";

// Store-level analytics — aggregates only, no customer PII.
export type StoreAnalytics = {
  period: AnalyticsPeriod;
  revenue: Money;
  orders: { count: number };
  topProducts: {
    productId: string;
    title: string;
    handle: string;
    unitsSold: number;
    revenue: Money;
  }[];
  lowStock: {
    threshold: number;
    count: number;
    items: {
      variantId: string;
      productId: string;
      productTitle: string;
      variantTitle: string;
      handle: string;
      sku: string | null;
      stock: number;
    }[];
  };
  pendingReviews: { count: number };
};

export type DashboardSummary = {
  orders: {
    total: number;
    today: number;
    pendingPayment: number;
    processing: number;
    paid: number;
    fulfilled: number;
    partiallyFulfilled: number;
    canceled: number;
    refunded: number;
  };
  revenue: {
    currencyCode: string;
    today: string;
    last30Days: string;
    allTime: string;
  };
  recentOrders: OrderSummary[];
  reviews: { pending: number };
  inventory: {
    lowStockThreshold: number;
    lowStockCount: number;
    lowStockVariants: (Variant & { productTitle: string; productHandle: string })[];
  };
};

// ---- Homepage Studio (Step 2) -----------------------------------------
// Mirrors volrep-backend/src/lib/homepage/schema.ts (the backend zod is the
// authority) — this describes the JSON the admin edits and posts back.
//
// The homepage is a CMS MIGRATION of the current hardcoded storefront
// homepage, not a redesign. The document is a singleton; the sections array
// order is the render order; the V1 document is exactly these 9 section
// types, each present once. Section data holds ONLY the editable label
// content — the fixed "VOLREP™" / "VOLREP™ /" chrome around an eyebrow is
// reproduced by the storefront renderer and is not stored.

// A media slot references a `site_media` asset by id (kind:"image") — NEVER
// a product_images row. `kind:"url"` holds an external / pasted URL.
export type HomepageMediaSlot = {
  kind: "placeholder" | "image" | "url";
  imageId: string | null;
  url: string;
  poster: string;
  alt: string;
  placeholderLabel: string;
  mediaType?: "image" | "video" | "gif";
  fileName?: string;
};

export type HomepageCta = { label: string; href: string };

export type HomepageHeroData = {
  eyebrow: string;
  heading: string;
  body: string;
  primaryCta: HomepageCta;
  secondaryCta: HomepageCta;
  visual: { media: HomepageMediaSlot; badge: string; productName: string; caption: string };
};

export type HomepageBestSellersData = {
  eyebrow: string;
  heading: string;
  body: string;
  source: { mode: "catalog"; limit: number };
};

export type HomepageRecoveryPhilosophyData = {
  eyebrow: string;
  heading: string;
  body: string;
  cta: HomepageCta;
  background: HomepageMediaSlot;
};

export type HomepageRecoverEverywhereZone = {
  title: string;
  description: string;
  media: HomepageMediaSlot;
  objectPosition: string;
  span: string;
};

export type HomepageRecoverEverywhereData = {
  heading: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  zones: HomepageRecoverEverywhereZone[];
};

export type HomepageWhyVolrepIcon = "shield" | "wave" | "soundwave" | "check";

export type HomepageWhyVolrepData = {
  eyebrow: string;
  heading: string;
  subtitle: string;
  features: { number: string; title: string; description: string; icon: HomepageWhyVolrepIcon }[];
  stats: { value: number; suffix: string; label: string }[];
};

export type HomepageTestimonialsData = {
  eyebrow: string;
  heading: string;
  body: string;
  rating: { stars: string; label: string; description: string };
  verifiedLabel: string;
  cards: { name: string; quote: string }[];
  trustline: { rating: string; label: string; audiences: string[] };
  trustItems: { value: string; label: string }[];
};

export type HomepageFaqData = {
  eyebrow: string;
  heading: string;
  subtitle: string;
  defaultOpen: number;
  items: { question: string; answer: string }[];
};

export type HomepageFinalCtaIcon = "truck" | "shield" | "return";

export type HomepageFinalCtaData = {
  eyebrow: string;
  heading: string;
  body: string;
  primaryCta: HomepageCta;
  secondaryCta: HomepageCta;
  rating: { stars: string; label: string };
  badges: { icon: HomepageFinalCtaIcon; label: string }[];
};

export type HomepageNewsletterData = {
  eyebrow: string;
  heading: string;
  body: string;
  emailLabel: string;
  emailPlaceholder: string;
  submitLabel: string;
  successMessage: string;
};

export type HomepageSection =
  | { id: string; type: "hero"; enabled: boolean; data: HomepageHeroData }
  | { id: string; type: "bestSellers"; enabled: boolean; data: HomepageBestSellersData }
  | { id: string; type: "recoveryPhilosophy"; enabled: boolean; data: HomepageRecoveryPhilosophyData }
  | { id: string; type: "recoverEverywhere"; enabled: boolean; data: HomepageRecoverEverywhereData }
  | { id: string; type: "whyVolrep"; enabled: boolean; data: HomepageWhyVolrepData }
  | { id: string; type: "testimonials"; enabled: boolean; data: HomepageTestimonialsData }
  | { id: string; type: "faq"; enabled: boolean; data: HomepageFaqData }
  | { id: string; type: "finalCta"; enabled: boolean; data: HomepageFinalCtaData }
  | { id: string; type: "newsletter"; enabled: boolean; data: HomepageNewsletterData };

export type HomepageSectionType = HomepageSection["type"];

export type HomepageDocument = {
  version: 1;
  settings: Record<string, never>;
  sections: HomepageSection[];
};

// GET/PUT /api/admin/homepage, POST .../publish, POST .../revert
// (mapHomepageAdmin in volrep-backend/src/mappers/admin.ts)
export type HomepageResponse = {
  draft: HomepageDocument;
  draftValid: boolean;
  published: HomepageDocument | null;
  publishedValid: boolean | null;
  hasPublished: boolean;
  draftMatchesPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

// POST /api/admin/homepage/preview-token
export type HomepagePreviewToken = { token: string; expiresAt: string };

// GET /api/admin/homepage/media  (mapSiteMedia) — the product-INDEPENDENT
// site media library. NEVER product_images.
export type SiteMediaAsset = {
  id: string;
  url: string;
  contentType: string;
  mediaType: "image" | "video" | "gif" | string;
  byteSize: number;
  width: number | null;
  height: number | null;
  originalFilename: string;
  altText: string;
  createdAt: string;
};

export type SiteMediaListResponse = { media: SiteMediaAsset[] };
export type SiteMediaUploadResponse = { media: SiteMediaAsset; deduped: boolean };
