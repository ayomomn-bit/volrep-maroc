import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireOwner, adminOf } from "../../plugins/admin-auth.js";
import { listShippingSettings, upsertShippingSetting } from "../../services/admin/shipping.js";

const countryParams = z.object({ countryCode: z.string().regex(/^[A-Za-z]{2}$/) });

const upsertSchema = z
  .object({
    active: z.boolean().optional(),
    flatRateAmount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).optional(),
    currency: z.string().length(3).optional(),
    handlingTimeMinDays: z.number().int().min(0).max(365).optional(),
    handlingTimeMaxDays: z.number().int().min(0).max(365).optional(),
    shippingTimeMinDays: z.number().int().min(0).max(365).optional(),
    shippingTimeMaxDays: z.number().int().min(0).max(365).optional(),
    returnWindowDays: z.number().int().min(0).max(365).optional(),
    returnShippingFree: z.boolean().optional(),
    refundProcessingDays: z.number().int().min(0).max(365).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to set.");

export async function adminShippingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/shipping-settings", async () => {
    return listShippingSettings();
  });

  // OWNER-only: changing shipping availability / rates is a
  // money-affecting, storefront-visible configuration change.
  app.put("/api/admin/shipping-settings/:countryCode", { preHandler: requireOwner }, async (request) => {
    const { countryCode } = countryParams.parse(request.params);
    const body = upsertSchema.parse(request.body);
    return { country: await upsertShippingSetting(adminOf(request), countryCode, body) };
  });
}
