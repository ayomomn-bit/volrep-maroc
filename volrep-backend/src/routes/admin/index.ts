import type { FastifyInstance } from "fastify";
import { csrfOriginGuard } from "../../plugins/admin-csrf.js";
import { adminAuthRoutes } from "./auth.js";
import { adminDashboardRoutes } from "./dashboard.js";
import { adminAnalyticsRoutes } from "./analytics.js";
import { adminOrderRoutes } from "./orders.js";
import { adminProductRoutes } from "./products.js";
import { adminStudioRoutes } from "./studio.js";
import { adminProductPageRoutes } from "./product-page.js";
import { adminHomepageRoutes } from "./homepage.js";
import { adminLandingPageRoutes } from "./landing-pages.js";
import { adminReviewRoutes } from "./reviews.js";
import { adminShippingRoutes } from "./shipping.js";
import { adminStoreSettingsRoutes } from "./store-settings.js";
import { adminIntegrationsRoutes } from "./integrations.js";
import { adminAuditRoutes } from "./audit.js";

// All /api/admin/* routes. Authentication is per-router: auth.ts guards
// login by rate limit only (it has no session yet), every other router
// installs `requireAdmin` as a preHandler hook, and a few individual
// routes add `requireOwner` on top. There is no path here that accepts
// the storefront's x-internal-api-key.
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // CSRF: reject state-changing requests that a browser tells us came from
  // an untrusted origin. Runs before every admin router, login included
  // (login CSRF matters too). See src/plugins/admin-csrf.ts.
  app.addHook("onRequest", csrfOriginGuard);

  // Every /api/admin/* response carries authenticated data — order PII
  // (email / phone / address), store settings, the audit trail. Keep it
  // out of any shared or on-disk HTTP cache (browser back/forward, a
  // corporate proxy, a shared workstation): the admin SPA already sends
  // `cache: "no-store"` on its side, this is the server-side backstop
  // (security hardening — Step 4 L4). Scoped to this encapsulation
  // context, so it never affects storefront or /media responses.
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  await app.register(adminAuthRoutes);
  await app.register(adminDashboardRoutes);
  await app.register(adminAnalyticsRoutes);
  await app.register(adminOrderRoutes);
  await app.register(adminProductRoutes);
  await app.register(adminStudioRoutes);
  await app.register(adminProductPageRoutes);
  await app.register(adminHomepageRoutes);
  await app.register(adminLandingPageRoutes);
  await app.register(adminReviewRoutes);
  await app.register(adminShippingRoutes);
  await app.register(adminStoreSettingsRoutes);
  await app.register(adminIntegrationsRoutes);
  await app.register(adminAuditRoutes);
}
