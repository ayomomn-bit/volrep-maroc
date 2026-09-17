import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalApiKey } from "../lib/internal-auth.js";
import { getStorefrontProductPage } from "../services/product-page.js";

const handleParams = z.object({ handle: z.string().min(1).max(200) });
const query = z.object({ preview: z.string().max(400).optional() });

// Storefront-facing, read-only. Returns the PUBLISHED "Page produit"
// document for a handle (or the code-owned default when nothing has been
// published for that product). With a valid `preview` token bound to the
// product, returns the unpublished draft instead.
//
// Same x-internal-api-key boundary and active-only visibility as
// GET /api/products/:handle. This is an ADDITIVE endpoint — the existing
// product detail contract is unchanged.
export async function productPageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/products/:handle/page", { preHandler: requireInternalApiKey }, async (request) => {
    const { handle } = handleParams.parse(request.params);
    const { preview } = query.parse(request.query);
    return getStorefrontProductPage(handle, { previewToken: preview });
  });
}
