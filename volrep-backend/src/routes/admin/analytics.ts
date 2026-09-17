import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../../plugins/admin-auth.js";
import { DEFAULT_LOW_STOCK_THRESHOLD, getStoreAnalytics } from "../../services/admin/analytics.js";

// Read-only store-level analytics. requireAdmin = staff + owner (viewing
// only; there is no owner-gated action here because there is no action at
// all). No mutation, no PII, no COD-operational metric.
// Period values mirror ANALYTICS_PERIODS in the service.
const querySchema = z
  .object({
    period: z.enum(["7d", "30d", "all"]).default("30d"),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(DEFAULT_LOW_STOCK_THRESHOLD),
  })
  .strict();

export async function adminAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/analytics", async (request) => {
    const { period, lowStockThreshold } = querySchema.parse(request.query);
    return getStoreAnalytics({ period, lowStockThreshold });
  });
}
