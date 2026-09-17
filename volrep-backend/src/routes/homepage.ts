import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalApiKey } from "../lib/internal-auth.js";
import { getStorefrontHomepage } from "../services/homepage.js";

const query = z.object({ preview: z.string().max(400).optional() });

// Storefront-facing, read-only. Returns the PUBLISHED homepage document (or
// the code-owned default when nothing has been published). Same
// x-internal-api-key boundary as GET /api/products — never a browser. With
// a valid signed `preview` token (minted by
// POST /api/admin/homepage/preview-token), returns the UNPUBLISHED draft
// instead — same contract shape as GET /api/products/:handle/page.
export async function homepageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/homepage", { preHandler: requireInternalApiKey }, async (request) => {
    const { preview } = query.parse(request.query);
    return getStorefrontHomepage({ previewToken: preview });
  });
}
