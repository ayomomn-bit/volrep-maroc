import type { FastifyInstance } from "fastify";
import { requireInternalApiKey } from "../lib/internal-auth.js";
import { getStoreSettings } from "../services/admin/store-settings.js";

// Storefront-facing, READ-ONLY view of the store identity Volrep owns
// (store_settings). Called server-to-server by the Next.js storefront with
// x-internal-api-key, exactly like /api/products — never from a browser.
//
// This is a NEW storefront contract, additive: it exposes only the six
// fields the storefront wires (name / tagline / support email / three
// social links). No secret, no admin data, no `updatedAt`, no write path.
// `getStoreSettings()` is a plain read (get-or-create the singleton) with
// no auth logic of its own — the auth boundary is this route's preHandler.
export async function storeSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/store-settings", { preHandler: requireInternalApiKey }, async () => {
    const s = await getStoreSettings();
    return {
      settings: {
        storeName: s.storeName,
        tagline: s.tagline,
        supportEmail: s.supportEmail,
        social: {
          instagram: s.social.instagram,
          tiktok: s.social.tiktok,
          youtube: s.social.youtube,
        },
      },
    };
  });
}
