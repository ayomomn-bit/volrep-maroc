import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { productPageTag } from "@/lib/backend/product-page";
import { isValidProductHandle } from "@/lib/backend/product-handle";

// On-demand revalidation, called server-to-server by the Volrep backend
// after a Product Studio "Page produit" publish so the change appears on the
// storefront immediately instead of waiting out the ISR window. Same
// credential boundary as every other backend call — the shared internal API
// key; a browser can never reach this usefully.
//
// Two shapes, both from the backend:
//   { handle: "<product-handle>" }  → revalidate that product page (original)
//   { scope: "homepage" }           → revalidate "/" + the "homepage" tag
// The homepage branch is inert today (the storefront homepage does not read
// the Homepage Studio document yet) but is here so a future publish goes
// live at once. The product-handle contract is completely unchanged.
export const dynamic = "force-dynamic";

const KEY = process.env.VOLREP_INTERNAL_API_KEY;

export async function POST(request: Request) {
  if (!KEY || request.headers.get("x-internal-api-key") !== KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { handle?: unknown; scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Homepage revalidation — only when explicitly scoped and no handle is
  // present, so the product path below is never affected.
  if (body.scope === "homepage" && body.handle === undefined) {
    revalidateTag("homepage", "max");
    revalidatePath("/");
    return NextResponse.json({ revalidated: true, scope: "homepage" });
  }

  // Validate BEFORE any revalidation call. The backend only ever sends a
  // real DB product handle (lowercase a–z / 0–9 / single hyphens, ≤200);
  // reject anything else — absolute URLs, `/` paths, `\`, `..`, query
  // strings, fragments, control chars, whitespace, over-long or non-string
  // values — rather than sanitising it, so a malformed value can never
  // reach revalidatePath()/revalidateTag() (security hardening — Step 4 L5).
  const { handle } = body;
  if (!isValidProductHandle(handle)) {
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  }

  // The page-document fetch is tagged with this (stale-while-revalidate);
  // revalidatePath also purges the rendered route so the next load is fresh.
  // Next 16 requires a cacheLife profile as revalidateTag's 2nd arg.
  revalidateTag(productPageTag(handle), "max");
  revalidatePath(`/products/${handle}`);
  revalidatePath(`/products/${handle}/preview`);

  return NextResponse.json({ revalidated: true, handle });
}
