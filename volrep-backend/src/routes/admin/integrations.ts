import type { FastifyInstance } from "fastify";
import { requireAdmin, requireOwner, adminOf } from "../../plugins/admin-auth.js";
import { getIntegrationsStatus, testLiryaConnection } from "../../services/admin/integrations.js";

// Configuration surface for the external systems Volrep connects to. This
// phase is deliberately minimal:
//   - Lirya: report config status (never the API key) + a read-only
//     connection test using the existing `pages:read` scope.
//   - COD: placeholder only — no API call, no credential, status is
//     always "not_connected".
// There is no webhook endpoint and no write path to any external system.
export async function adminIntegrationsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/integrations", async () => {
    return getIntegrationsStatus();
  });

  // OWNER-only: a connection test reaches out to an external system.
  app.post("/api/admin/integrations/lirya/test", { preHandler: requireOwner }, async (request) => {
    return testLiryaConnection(adminOf(request));
  });
}
