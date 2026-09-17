import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { homepage, HOMEPAGE_ID } from "../db/schema/index.js";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "../lib/homepage/defaults.js";
import {
  mapDocumentMediaSlots,
  parseHomepageDocument,
  siteMediaIdsInDocument,
  type HomepageDocument,
} from "../lib/homepage/schema.js";
import { verifyHomepagePreviewToken } from "../lib/homepage/preview-token.js";
import { resolveSiteMediaUrls } from "./admin/site-media.js";

export type StorefrontHomepage = {
  page: HomepageDocument;
  // true when this response is the unpublished draft (valid preview token),
  // false when it is the published document (or the code-owned default).
  preview: boolean;
  // true when `page` is the code-owned default because nothing has been
  // published yet.
  isDefault: boolean;
};

// Storefront-facing. Never writes. Returns the PUBLISHED homepage document,
// or the code-owned default when nothing has been published (so `/` renders
// exactly today's page until an editor publishes). With a valid homepage
// preview token, returns the UNPUBLISHED draft instead — same shape as
// getStorefrontProductPage's preview handling (services/product-page.ts).
export async function getStorefrontHomepage(
  opts: { previewToken?: string | undefined } = {},
): Promise<StorefrontHomepage> {
  const [row] = await db
    .select({ draft: homepage.draft, published: homepage.published })
    .from(homepage)
    .where(eq(homepage.id, HOMEPAGE_ID))
    .limit(1);

  const wantsDraft =
    opts.previewToken != null &&
    opts.previewToken.length > 0 &&
    verifyHomepagePreviewToken(opts.previewToken);

  if (wantsDraft && row?.draft) {
    return { page: await resolveImageSlots(safeParse(row.draft)), preview: true, isDefault: false };
  }

  if (!row?.published) {
    return { page: DEFAULT_HOMEPAGE_DOCUMENT, preview: false, isDefault: true };
  }

  return { page: await resolveImageSlots(safeParse(row.published)), preview: false, isDefault: false };
}

// A stored document that fails validation (a hand DB edit, or a schema
// change that outpaced a re-publish) must never blank the storefront — fall
// back to the code-owned default.
function safeParse(value: unknown): HomepageDocument {
  try {
    return parseHomepageDocument(value);
  } catch {
    return DEFAULT_HOMEPAGE_DOCUMENT;
  }
}

// Resolve `kind:"image"` media slots (which carry only a site_media id) into
// a concrete URL. A slot whose asset no longer exists is downgraded to an
// empty placeholder. `url` / `placeholder` slots pass through untouched.
async function resolveImageSlots(doc: HomepageDocument): Promise<HomepageDocument> {
  const ids = siteMediaIdsInDocument(doc);
  if (ids.length === 0) return doc;

  const byId = await resolveSiteMediaUrls(ids);

  return mapDocumentMediaSlots(doc, (slot) => {
    if (slot.kind !== "image" || !slot.imageId) return slot;
    const asset = byId.get(slot.imageId);
    if (!asset) {
      return { ...slot, kind: "placeholder", imageId: null, url: "", poster: "", mediaType: "image", fileName: "" };
    }
    return {
      ...slot,
      url: asset.url,
      alt: slot.alt || asset.altText || "",
      mediaType: asset.mediaType === "gif" ? "gif" : asset.mediaType === "video" ? "video" : "image",
    };
  });
}
