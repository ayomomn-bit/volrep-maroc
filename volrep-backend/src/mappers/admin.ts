import { toMoney, type Money } from "../lib/money.js";
import { allowedTransitionsFor, type OrderStatus } from "../lib/order-status.js";
import { formatOrderNumber } from "./order.js";
import type {
  adminAuditLog,
  adminUsers,
  fulfillments,
  orderLineItems,
  orders,
  productImages,
  productLandingPages,
  productOptions,
  productPages,
  products,
  productVariants,
  reviews,
  shippingSettings,
  storeSettings,
  homepage,
  siteMedia,
} from "../db/schema/index.js";
import { parsePageDocument, type PageDocument } from "../lib/product-page/schema.js";
import { parseHomepageDocument, type HomepageDocument } from "../lib/homepage/schema.js";

type AdminUserRow = typeof adminUsers.$inferSelect;
type OrderRow = typeof orders.$inferSelect;
type OrderLineRow = typeof orderLineItems.$inferSelect;
type FulfillmentRow = typeof fulfillments.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type ProductImageRow = typeof productImages.$inferSelect;
type ProductOptionRow = typeof productOptions.$inferSelect;
type ProductVariantRow = typeof productVariants.$inferSelect;
type ReviewRow = typeof reviews.$inferSelect;
type ShippingRow = typeof shippingSettings.$inferSelect;
type StoreSettingsRow = typeof storeSettings.$inferSelect;
type AuditRow = typeof adminAuditLog.$inferSelect;
type LandingPageRow = typeof productLandingPages.$inferSelect;
type ProductPageRow = typeof productPages.$inferSelect;
type HomepageRow = typeof homepage.$inferSelect;
type SiteMediaRow = typeof siteMedia.$inferSelect;

// ---- auth --------------------------------------------------------------

// The public shape of an admin user — NEVER includes password_hash.
export function mapAdminUser(row: Pick<AdminUserRow, "id" | "email" | "role" | "lastLoginAt" | "createdAt">) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---- orders -----------------------------------------------------------

// Payment state is derived, not a stored column: the schema tracks it via
// orders.status ('pending_payment' vs everything past it) plus paidAt.
function paymentStatus(row: OrderRow): "pending" | "paid" | "refunded" {
  if (row.status === "refunded" || row.status === "partially_refunded") return "refunded";
  if (row.paidAt || row.status !== "pending_payment") return "paid";
  return "pending";
}

export function mapAdminFulfillment(row: FulfillmentRow) {
  return {
    id: row.id,
    status: row.status,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    trackingUrl: row.trackingUrl,
    shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAdminOrderSummary(row: OrderRow, itemCount: number) {
  return {
    id: row.id,
    orderNumber: formatOrderNumber(row.orderNumber),
    status: row.status,
    paymentStatus: paymentStatus(row),
    email: row.email,
    phone: row.phone,
    total: toMoney(row.totalAmount, row.currency),
    currency: row.currency,
    itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type OrderTimelineEntry = {
  id: string;
  at: string;
  action: string;
  actorEmail: string | null;
  summary: string;
  metadata: unknown;
};

export function mapAdminOrderDetail(
  row: OrderRow,
  lines: OrderLineRow[],
  fulfillment: FulfillmentRow | null,
  timeline: OrderTimelineEntry[] = [],
) {
  return {
    id: row.id,
    orderNumber: formatOrderNumber(row.orderNumber),
    status: row.status,
    // The valid next states for THIS order — the admin UI renders exactly
    // these as transition buttons (and the backend still re-checks).
    allowedTransitions: allowedTransitionsFor(row.status as OrderStatus),
    paymentStatus: paymentStatus(row),
    customer: {
      email: row.email,
      phone: row.phone,
    },
    shippingAddress: row.shippingAddress,
    payment: {
      provider: row.paymentProvider,
      reference: row.paymentReference,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    },
    amounts: {
      subtotal: toMoney(row.subtotalAmount, row.currency),
      shipping: toMoney(row.shippingAmount, row.currency),
      discount: toMoney(row.discountAmount, row.currency),
      total: toMoney(row.totalAmount, row.currency),
      currency: row.currency,
    },
    lineItems: lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      productTitle: line.productTitle,
      variantTitle: line.variantTitle,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: toMoney(line.unitPriceAmount, row.currency),
      lineTotal: toMoney(line.lineTotalAmount, row.currency),
    })),
    fulfillment: fulfillment ? mapAdminFulfillment(fulfillment) : null,
    timeline,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---- products / variants -------------------------------------------

// Admin variant view DOES include stock (unlike the storefront mapper,
// which deliberately hides it — src/mappers/product.ts).
export function mapAdminVariant(row: ProductVariantRow): {
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
} {
  return {
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    title: row.title,
    selectedOptions: row.selectedOptions,
    price: toMoney(row.priceAmount, row.priceCurrency),
    compareAtPrice: row.compareAtAmount ? toMoney(row.compareAtAmount, row.priceCurrency) : null,
    currency: row.priceCurrency,
    stock: row.stock,
    availableForSale: row.availableForSale,
    imageId: row.imageId,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAdminImage(row: ProductImageRow) {
  return {
    id: row.id,
    url: row.url,
    altText: row.altText,
    width: row.width,
    height: row.height,
    position: row.position,
    // Volrep-owned media metadata (Phase 7C-2). `owned` is the single
    // signal the editor uses to tell an uploaded image apart from a legacy
    // external URL (e.g. cdn.shopify.com). An admin cannot flip this.
    owned: row.storageKey !== null,
    contentType: row.contentType,
    byteSize: row.byteSize,
  };
}

export function mapAdminOption(row: ProductOptionRow) {
  return { id: row.id, name: row.name, values: row.values, position: row.position };
}

export type ProductSummaryExtra = {
  variantCount: number;
  // Sum of stock across every variant.
  totalStock: number;
  // Cheapest / most expensive variant price, or null when there are no
  // variants. Currency is the catalog currency (MAD).
  priceRange: { min: Money; max: Money } | null;
  // First image by position, for the list thumbnail.
  featuredImageUrl: string | null;
};

export function mapAdminProductSummary(row: ProductRow, extra: ProductSummaryExtra) {
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    status: row.status,
    productType: row.productType,
    tags: row.tags,
    variantCount: extra.variantCount,
    totalStock: extra.totalStock,
    priceRange: extra.priceRange,
    featuredImageUrl: extra.featuredImageUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAdminProductDetail(
  row: ProductRow,
  images: ProductImageRow[],
  options: ProductOptionRow[],
  variants: ProductVariantRow[],
) {
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    description: row.description,
    status: row.status,
    productType: row.productType,
    tags: row.tags,
    // Structured product content. `subtitle` (accroche) is kept as product
    // metadata; the richer marketing fields (marketing_copy / benefits /
    // selling_points / seo_*) are no longer edited in Product Studio — that
    // content lives in Lirya — so they are no longer projected here. The
    // columns still exist in the DB pending a separate cleanup phase.
    content: {
      subtitle: row.subtitle,
    },
    images: images.map(mapAdminImage),
    options: options.map(mapAdminOption),
    variants: variants.map(mapAdminVariant),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---- Product Studio ----------------------------------------------
//
// Product Studio owns the product (identity, variants, price, media) and
// its Lirya landing-page binding. The Hero + content-block projections
// were removed once landing-page content ownership moved fully to Lirya;
// the `hero_*` columns and `product_content_blocks` table still exist in
// the DB (destructive cleanup is a separate, later phase) but nothing
// reads them here any more.

// The admin-facing projection of one Product ↔ Lirya binding. Carries the
// disposable cache plus three DERIVED, server-computed fields:
//  - `verified`   — the integrity check (§8): does Lirya's
//                   external_ref.product_id point back at this product?
//  - `previewUrl` — the public URL, but ONLY when the page is published
//                   (§6); null for hidden/draft so the UI disables Preview.
//  - `editorUrl`  — the outbound legacy-editor link (§7), built from
//                   LIRYA_ADMIN_BASE_URL server-side (the API key never
//                   reaches the browser); null when the base URL is unset
//                   or the page is an API-created structured draft with no
//                   legacy editor entry.
export type LandingPageMapContext = { productId: string; adminBaseUrl?: string | undefined };

export function mapLandingPage(row: LandingPageRow, ctx: LandingPageMapContext) {
  const isPublished = row.cachedStatus === "published";
  // The legacy Lirya editor (/editor.html?slug=) only works for legacy_html
  // landing pages. Every binding is type "landing" by construction (checked
  // on associate), so the remaining gates are: legacy_html content source
  // and a non-draft status. Structured / draft / thankyou pages get no link.
  const hasLegacyEditor = row.cachedContentSource === "legacy_html" && row.cachedStatus !== "draft";
  const editorUrl =
    ctx.adminBaseUrl && hasLegacyEditor && row.cachedSlug
      ? `${ctx.adminBaseUrl.replace(/\/+$/, "")}/editor.html?slug=${encodeURIComponent(row.cachedSlug)}`
      : null;

  return {
    id: row.id,
    liryaPageId: row.liryaPageId,
    role: row.role,
    cachedStatus: row.cachedStatus,
    name: row.cachedName,
    slug: row.cachedSlug,
    template: row.cachedTemplate,
    version: row.liryaVersion,
    publicUrl: row.cachedPublicUrl,
    previewUrl: isPublished ? row.cachedPublicUrl : null,
    editorUrl,
    verified: row.cachedExternalRefProductId != null && row.cachedExternalRefProductId === ctx.productId,
    externalRefProductId: row.cachedExternalRefProductId,
    syncError: row.syncError,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Non-blocking "how complete is this product's presentation" summary —
// drives the Vue d'ensemble indicators. Every field is derived, never
// stored, so it can never drift from the underlying data. Marketing-page
// dimensions (hero / content blocks / SEO) were dropped when that content
// moved to Lirya — the studio now tracks media, commerce and the binding.
export function computeStudioCompleteness(args: {
  images: ProductImageRow[];
  variants: ProductVariantRow[];
  landingPages: LandingPageRow[];
  productId: string;
  status: ProductRow["status"];
}) {
  const { images, variants, landingPages, productId, status } = args;
  const ownedImages = images.filter((i) => i.storageKey !== null).length;

  return {
    media: {
      total: images.length,
      owned: ownedImages,
      ready: images.length > 0,
    },
    landingPages: {
      // Every row is a real Lirya binding (V1 has no "unlinked" placeholder
      // row), so total === linked. `verified` counts bindings whose Lirya
      // external_ref points back at this product; `needsAttention` flags any
      // binding whose last sync failed.
      total: landingPages.length,
      linked: landingPages.length,
      verified: landingPages.filter((p) => p.cachedExternalRefProductId === productId).length,
      needsAttention: landingPages.some((p) => p.syncError != null),
    },
    commerce: {
      variants: variants.length,
      priced: variants.length > 0 && variants.every((v) => Number(v.priceAmount) > 0),
      published: status === "active",
    },
  };
}

// The full Product Studio payload for one product — everything the studio
// UI needs in one request.
export function mapProductStudio(args: {
  product: ProductRow;
  images: ProductImageRow[];
  options: ProductOptionRow[];
  variants: ProductVariantRow[];
  landingPages: LandingPageRow[];
  // For the outbound "Modifier le contenu dans Lirya" link only. The studio
  // payload is cache-only — it never triggers a Lirya request.
  liryaAdminBaseUrl?: string | undefined;
}) {
  const { product, images, options, variants, landingPages } = args;
  return {
    product: mapAdminProductDetail(product, images, options, variants),
    landingPages: landingPages.map((row) =>
      mapLandingPage(row, { productId: product.id, adminBaseUrl: args.liryaAdminBaseUrl }),
    ),
    completeness: computeStudioCompleteness({
      images,
      variants,
      landingPages,
      productId: product.id,
      status: product.status,
    }),
  };
}

// ---- Product Studio "Page produit" ---------------------------------
//
// The admin projection of one product_pages row: the draft the Studio
// edits, the published document the storefront serves, and derived flags
// the UI needs (has anything been published; does the draft differ from
// what's live). The documents are stored already-validated (saveDraft is
// the gate); a stored document that no longer parses is surfaced as-is so
// the admin can see and fix it, with `*Valid` false.
export function mapProductPageAdmin(row: ProductPageRow) {
  const draft = coerceDoc(row.draft);
  const published = row.published != null ? coerceDoc(row.published) : null;

  return {
    draft: draft.doc,
    draftValid: draft.valid,
    published: published?.doc ?? null,
    publishedValid: published?.valid ?? null,
    hasPublished: row.published != null,
    // Whether the draft has edits that are not live yet. When nothing is
    // published, any draft that differs from the code-owned default counts.
    draftMatchesPublished:
      published != null && JSON.stringify(draft.doc) === JSON.stringify(published.doc),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

function coerceDoc(value: unknown): { doc: PageDocument | unknown; valid: boolean } {
  try {
    return { doc: parsePageDocument(value), valid: true };
  } catch {
    return { doc: value, valid: false };
  }
}

// ---- Homepage Studio ----------------------------------------------------
//
// Same projection shape as mapProductPageAdmin: the editable draft, the
// published document the storefront will serve, and derived flags.
export function mapHomepageAdmin(row: HomepageRow) {
  const draft = coerceHomepageDoc(row.draft);
  const published = row.published != null ? coerceHomepageDoc(row.published) : null;

  return {
    draft: draft.doc,
    draftValid: draft.valid,
    published: published?.doc ?? null,
    publishedValid: published?.valid ?? null,
    hasPublished: row.published != null,
    draftMatchesPublished:
      published != null && JSON.stringify(draft.doc) === JSON.stringify(published.doc),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

function coerceHomepageDoc(value: unknown): { doc: HomepageDocument | unknown; valid: boolean } {
  try {
    return { doc: parseHomepageDocument(value), valid: true };
  } catch {
    return { doc: value, valid: false };
  }
}

export function mapSiteMedia(row: SiteMediaRow) {
  return {
    id: row.id,
    url: row.url,
    contentType: row.contentType,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    originalFilename: row.originalFilename,
    altText: row.altText,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---- reviews --------------------------------------------------------

// Admin review view includes the moderation email and status; still
// surfaces verifiedPurchase as read-only (it is a generated column).
// `product` is joined for the moderation queue so the admin sees what is
// being reviewed without a second lookup.
export function mapAdminReview(row: ReviewRow, product?: { title: string; handle: string } | null) {
  return {
    id: row.id,
    productId: row.productId,
    productTitle: product?.title ?? null,
    productHandle: product?.handle ?? null,
    orderId: row.orderId,
    author: row.author,
    email: row.email,
    rating: row.rating,
    body: row.body,
    status: row.status,
    verifiedPurchase: row.verifiedPurchase ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---- shipping ------------------------------------------------------

export function mapAdminShipping(row: ShippingRow) {
  return {
    id: row.id,
    countryCode: row.countryCode,
    active: row.active,
    flatRate: toMoney(row.flatRateAmount, row.currency),
    currency: row.currency,
    handlingTimeDays: { min: row.handlingTimeMinDays, max: row.handlingTimeMaxDays },
    shippingTimeDays: { min: row.shippingTimeMinDays, max: row.shippingTimeMaxDays },
    returnWindowDays: row.returnWindowDays,
    returnShippingFree: row.returnShippingFree,
    refundProcessingDays: row.refundProcessingDays,
  };
}

// ---- store settings ----------------------------------------------------

// Store identity Volrep owns. No secret ever passes through here.
export function mapStoreSettings(row: StoreSettingsRow) {
  return {
    storeName: row.storeName,
    tagline: row.tagline,
    supportEmail: row.supportEmail,
    social: {
      instagram: row.socialInstagram,
      tiktok: row.socialTiktok,
      youtube: row.socialYoutube,
    },
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---- audit ---------------------------------------------------------

export function mapAuditEntry(row: AuditRow, adminEmail?: string | null) {
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    adminEmail: adminEmail ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}
