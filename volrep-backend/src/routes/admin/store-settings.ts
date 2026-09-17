import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireOwner, adminOf } from "../../plugins/admin-auth.js";
import { getStoreSettings, updateStoreSettings } from "../../services/admin/store-settings.js";

// Store identity Volrep owns as source of truth. Reading is available to
// any admin; writing is OWNER-only — like shipping, it is storefront-facing
// configuration. No secret is stored or returned here.
const updateSchema = z
  .object({
    storeName: z.string().max(200).optional(),
    tagline: z.string().max(500).optional(),
    supportEmail: z.string().max(200).optional(),
    socialInstagram: z.string().max(500).optional(),
    socialTiktok: z.string().max(500).optional(),
    socialYoutube: z.string().max(500).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to set.");

export async function adminStoreSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/store-settings", async () => {
    return { settings: await getStoreSettings() };
  });

  app.put("/api/admin/store-settings", { preHandler: requireOwner }, async (request) => {
    const body = updateSchema.parse(request.body);
    return { settings: await updateStoreSettings(adminOf(request), body) };
  });
}
