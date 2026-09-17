import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, adminOf } from "../../plugins/admin-auth.js";
import {
  associateLandingPage,
  listLiryaPages,
  listProductLandingPages,
  liryaConfigured,
  unassociateLandingPage,
} from "../../services/admin/landing-pages.js";

const idParams = z.object({ id: z.string().uuid() });
const bindingParams = z.object({ id: z.string().uuid(), bindingId: z.string().uuid() });

const listQuery = z.object({
  // Default: refresh from Lirya when configured. `?refresh=0` skips it.
  refresh: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === undefined || v === "1" || v === "true"),
});

const associateBody = z
  .object({
    liryaPageId: z.string().min(1).max(200),
    role: z.string().min(1).max(40).optional(),
  })
  .strict();

const pickerQuery = z.object({
  cursor: z.string().min(1).max(500).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Lirya landing-page integration (V1, READ-ONLY). Every route is behind
// requireAdmin (staff-ok — same tier as the Product Studio content
// routes). Nothing here writes to Lirya: the only outbound calls are
// GET /api/v1/pages and GET /api/v1/pages/{id}.
export async function adminLandingPageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  // Bindings for one product (+ best-effort cache refresh from Lirya).
  app.get("/api/admin/products/:id/landing-pages", async (request) => {
    const { id } = idParams.parse(request.params);
    const { refresh } = listQuery.parse(request.query);
    const landingPages = await listProductLandingPages(id, { refresh });
    return { landingPages, liryaConfigured: liryaConfigured() };
  });

  // Associate a Lirya page with a product (default role: primary).
  app.post("/api/admin/products/:id/landing-pages", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = associateBody.parse(request.body);
    reply.status(201);
    return { landingPage: await associateLandingPage(adminOf(request), id, body) };
  });

  // Remove Volrep's binding row. Never touches the Lirya page.
  app.delete("/api/admin/products/:id/landing-pages/:bindingId", async (request) => {
    const { id, bindingId } = bindingParams.parse(request.params);
    return { landingPages: await unassociateLandingPage(adminOf(request), id, bindingId) };
  });

  // The picker feed: published landing pages from Lirya, cursor-paginated,
  // with an optional client-side name filter (Lirya has no free-text
  // search in V1).
  app.get("/api/admin/lirya/pages", async (request) => {
    const { cursor, q, limit } = pickerQuery.parse(request.query);
    const result = await listLiryaPages({ cursor, q, limit });
    return { ...result, liryaConfigured: liryaConfigured() };
  });
}
