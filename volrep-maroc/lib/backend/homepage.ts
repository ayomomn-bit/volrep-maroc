import "server-only";
import { backendFetch } from "@/lib/backend/client";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "@/lib/homepage/default-document";
import { isHomepageDocument, type HomepageDocument } from "@/lib/homepage/types";

// Cache tag for the homepage document fetch. The backend pings
// POST /api/revalidate with { scope: "homepage" } after a Homepage Studio
// publish (see app/api/revalidate/route.ts), which calls
// revalidateTag(HOMEPAGE_TAG, "max") + revalidatePath("/") so the storefront
// picks up the new document without waiting out the revalidate window.
export const HOMEPAGE_TAG = "homepage";

// Server-only. Fetches the "/" homepage document. Normally this is the
// PUBLISHED document; with a valid signed preview token (minted by the
// admin backend, see volrep-backend/src/lib/homepage/preview-token.ts) it
// is the DRAFT. Never throws: a missing published document / backend error
// / unrecognised shape all resolve to the code-owned
// DEFAULT_HOMEPAGE_DOCUMENT — a 1:1 copy of the homepage that shipped before
// Homepage Studio — so "/" can never blank.

export type StorefrontHomepage = {
  page: HomepageDocument;
  // true when this response is the unpublished draft (valid preview token).
  preview: boolean;
  isDefault: boolean;
};

const FALLBACK: StorefrontHomepage = {
  page: DEFAULT_HOMEPAGE_DOCUMENT,
  preview: false,
  isDefault: true,
};

export async function getStorefrontHomepage(
  opts: { previewToken?: string | undefined } = {},
): Promise<StorefrontHomepage> {
  try {
    const data = await backendFetch<{ page: unknown; preview?: unknown; isDefault?: unknown }>(
      "/api/homepage",
      {
        query: opts.previewToken ? { preview: opts.previewToken } : undefined,
        // A preview must always be fresh; a normal read shares the homepage
        // fetch's staleness budget but is also tag-revalidated on publish.
        next: opts.previewToken ? { revalidate: 0 } : { revalidate: 300, tags: [HOMEPAGE_TAG] },
      },
    );

    if (isHomepageDocument(data.page)) {
      return { page: data.page, preview: Boolean(data.preview), isDefault: Boolean(data.isDefault) };
    }

    console.error("Volrep homepage: backend returned an unrecognised document shape");
    return FALLBACK;
  } catch (error) {
    console.error("Volrep backend getStorefrontHomepage error:", error);
    return FALLBACK;
  }
}
