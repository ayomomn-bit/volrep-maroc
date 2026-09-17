import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../../plugins/admin-auth.js";
import { getProductStudio } from "../../services/admin/studio.js";

const idParams = z.object({ id: z.string().uuid() });

// Product Studio. Read-only aggregate for one product; every mutation the
// studio needs is served by the existing product / variant / media routes
// (owner-only status change unchanged) or, for the landing-page binding,
// by ./landing-pages.ts (the Lirya V1 integration surface).
//
// The Hero and content-block write endpoints were removed when landing-page
// content ownership moved fully to Lirya. No route here touches commerce,
// checkout, COD or the Lirya API.
export async function adminStudioRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/products/:id/studio", async (request) => {
    const { id } = idParams.parse(request.params);
    return getProductStudio(id);
  });
}
