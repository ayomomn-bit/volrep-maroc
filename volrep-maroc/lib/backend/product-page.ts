import "server-only";
import { backendFetch } from "@/lib/backend/client";
import { DEFAULT_PAGE_DOCUMENT } from "@/lib/product-page/default-document";
import { isPageDocument, type PageDocument } from "@/lib/product-page/types";

// Cache tag for one product's page fetch. The backend pings
// POST /api/revalidate after a publish so the storefront picks up the new
// document without waiting out the revalidate window.
export function productPageTag(handle: string): string {
  return `product-page:${handle}`;
}

// Server-only. Fetches the "Page produit" document the storefront renders
// for a product. Normally this is the PUBLISHED document; with a valid
// signed preview token (minted by the admin, see
// volrep-backend/src/lib/product-page/preview-token.ts) it is the DRAFT.
//
// Never throws: a missing product / backend error / unrecognised shape all
// resolve to the code-owned DEFAULT_PAGE_DOCUMENT — a 1:1 copy of what the
// page rendered before Product Studio — so the product page can never
// blank. `notFound()` on the page is still driven by getProduct() being
// null, exactly as before.

export type StorefrontProductPage = {
  page: PageDocument;
  preview: boolean;
  isDefault: boolean;
};

const FALLBACK: StorefrontProductPage = {
  page: DEFAULT_PAGE_DOCUMENT,
  preview: false,
  isDefault: true,
};

export async function getStorefrontProductPage(
  handle: string,
  opts: { previewToken?: string | undefined } = {},
): Promise<StorefrontProductPage> {
  try {
    const data = await backendFetch<{ page: unknown; preview?: unknown; isDefault?: unknown }>(
      `/api/products/${encodeURIComponent(handle)}/page`,
      {
        query: opts.previewToken ? { preview: opts.previewToken } : undefined,
        // A preview must always be fresh; a normal read shares the product
        // fetch's staleness budget but is also tag-revalidated on publish.
        next: opts.previewToken
          ? { revalidate: 0 }
          : { revalidate: 300, tags: [productPageTag(handle)] },
      },
    );

    if (isPageDocument(data.page)) {
      return {
        page: data.page,
        preview: Boolean(data.preview),
        isDefault: Boolean(data.isDefault),
      };
    }

    console.error("Volrep product page: backend returned an unrecognised document shape");
    return FALLBACK;
  } catch (error) {
    console.error("Volrep backend getStorefrontProductPage error:", error);
    return FALLBACK;
  }
}
