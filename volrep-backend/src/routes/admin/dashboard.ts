import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../../plugins/admin-auth.js";
import { DEFAULT_LOW_STOCK_THRESHOLD, getDashboardSummary } from "../../services/admin/dashboard.js";

const querySchema = z
  .object({ lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(DEFAULT_LOW_STOCK_THRESHOLD) })
  .strict();

export async function adminDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/dashboard", async (request) => {
    const { lowStockThreshold } = querySchema.parse(request.query);
    return getDashboardSummary(lowStockThreshold);
  });
}
