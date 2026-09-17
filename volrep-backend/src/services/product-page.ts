import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { AppError } from "../lib/errors.js";
import { productImages, productPages, products } from "../db/schema/index.js";
import { DEFAULT_PAGE_DOCUMENT } from "../lib/product-page/defaults.js";
import {
  imageIdsInDocument,
  mapDocumentMediaSlots,
  parsePageDocument,
  type PageDocument,
} from "../lib/product-page/schema.js";
import { verifyPreviewToken } from "../lib/product-page/preview-token.js";

export type StorefrontProductPage = {
  page: PageDocument;
  // true when this response is the unpublished draft (valid preview token),
  // false when it is the published page (or the code-owned default).
  preview: boolean;
  // true when `page` is the code-owned default document because nothing has
  // been published for this product yet.
  isDefault: boolean;
};

// Storefront-facing. Never writes. Returns the PUBLISHED page document for a
// handle, or the code-owned default when the product has never published a
// page (so a brand-new product still renders exactly today's page). With a
// valid preview token bound to this product, returns the DRAFT instead.
//
// Same active-only visibility rule as GET /api/products/:handle — a
// draft/archived product 404s here too.
export async function getStorefrontProductPage(
  handle: string,
  opts: { previewToken?: string | undefined } = {},
): Promise<StorefrontProductPage> {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.handle, handle), eq(products.status, "active")))
    .limit(1);
  if (!product) throw AppError.notFound("Product not found");

  const [row] = await db
    .select({ draft: productPages.draft, published: productPages.published })
    .from(productPages)
    .where(eq(productPages.productId, product.id))
    .limit(1);

  const wantsDraft =
    opts.previewToken != null &&
    opts.previewToken.length > 0 &&
    verifyPreviewToken(opts.previewToken, product.id);

  if (wantsDraft && row?.draft) {
    return { page: await resolve(product.id, safeParse(row.draft)), preview: true, isDefault: false };
  }

  if (row?.published) {
    return {
      page: await resolve(product.id, safeParse(row.published)),
      preview: false,
      isDefault: false,
    };
  }

  return { page: DEFAULT_PAGE_DOCUMENT, preview: false, isDefault: true };
}

// A stored document that fails validation (a hand DB edit, or a schema
// change that outpaced a re-publish) must never blank the storefront —
// fall back to the code-owned default.
function safeParse(value: unknown): PageDocument {
  try {
    return parsePageDocument(value);
  } catch {
    return DEFAULT_PAGE_DOCUMENT;
  }
}

// Resolve `kind: "image"` media slots (which carry only a product_images id)
// into a concrete URL the storefront can render. A slot whose image no
// longer exists is downgraded to an empty placeholder. `url` / `placeholder`
// slots pass through untouched. The admin read path keeps the raw imageId
// (the picker needs it) — only this storefront read resolves.
async function resolve(productId: string, doc: PageDocument): Promise<PageDocument> {
  const ids = imageIdsInDocument(doc);
  if (ids.length === 0) return doc;

  const rows = await db
    .select({ id: productImages.id, url: productImages.url, altText: productImages.altText })
    .from(productImages)
    .where(and(eq(productImages.productId, productId), inArray(productImages.id, ids)));
  const byId = new Map(rows.map((r) => [r.id, r]));

  return mapDocumentMediaSlots(doc, (slot) => {
    if (slot.kind !== "image" || !slot.imageId) return slot;
    const image = byId.get(slot.imageId);
    if (!image) {
      return { ...slot, kind: "placeholder", imageId: null, url: "", poster: "", mediaType: "image", fileName: "" };
    }
    return { ...slot, url: image.url, alt: slot.alt || image.altText || "", mediaType: "image" };
  });
}
