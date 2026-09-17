import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { shippingSettings } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminShipping } from "../../mappers/admin.js";
import type { AdminContext } from "./auth.js";

export async function listShippingSettings() {
  const rows = await db.select().from(shippingSettings).orderBy(asc(shippingSettings.countryCode));
  return { countries: rows.map(mapAdminShipping) };
}

export type ShippingUpsertInput = {
  active?: boolean | undefined;
  flatRateAmount?: string | undefined;
  currency?: string | undefined;
  handlingTimeMinDays?: number | undefined;
  handlingTimeMaxDays?: number | undefined;
  shippingTimeMinDays?: number | undefined;
  shippingTimeMaxDays?: number | undefined;
  returnWindowDays?: number | undefined;
  returnShippingFree?: boolean | undefined;
  refundProcessingDays?: number | undefined;
};

// One config row per country_code (unique). Upsert so the admin doesn't
// have to know whether a country was configured before. The "Big 4"
// destination list is still an open business decision (schema comment /
// Architecture §17) — this endpoint is how it gets set, one country at a
// time, not a hard-coded list.
export async function upsertShippingSetting(admin: AdminContext, countryCodeRaw: string, input: ShippingUpsertInput) {
  const countryCode = countryCodeRaw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw AppError.badRequest("Country code must be a 2-letter ISO code.");
  }
  if (input.flatRateAmount !== undefined && !/^\d{1,8}(\.\d{1,2})?$/.test(input.flatRateAmount)) {
    throw AppError.badRequest("Flat rate must be a non-negative amount with at most 2 decimals.");
  }
  for (const [key, value] of Object.entries(input)) {
    if (key.endsWith("Days") && value !== undefined && (!Number.isInteger(value) || (value as number) < 0)) {
      throw AppError.badRequest(`${key} must be a non-negative integer.`);
    }
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(shippingSettings).where(eq(shippingSettings.countryCode, countryCode)).limit(1);

    const values = {
      countryCode,
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.flatRateAmount !== undefined ? { flatRateAmount: input.flatRateAmount } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.handlingTimeMinDays !== undefined ? { handlingTimeMinDays: input.handlingTimeMinDays } : {}),
      ...(input.handlingTimeMaxDays !== undefined ? { handlingTimeMaxDays: input.handlingTimeMaxDays } : {}),
      ...(input.shippingTimeMinDays !== undefined ? { shippingTimeMinDays: input.shippingTimeMinDays } : {}),
      ...(input.shippingTimeMaxDays !== undefined ? { shippingTimeMaxDays: input.shippingTimeMaxDays } : {}),
      ...(input.returnWindowDays !== undefined ? { returnWindowDays: input.returnWindowDays } : {}),
      ...(input.returnShippingFree !== undefined ? { returnShippingFree: input.returnShippingFree } : {}),
      ...(input.refundProcessingDays !== undefined ? { refundProcessingDays: input.refundProcessingDays } : {}),
    };

    const [row] = await tx
      .insert(shippingSettings)
      .values(values)
      .onConflictDoUpdate({ target: shippingSettings.countryCode, set: values })
      .returning();
    if (!row) throw new Error("Shipping settings upsert returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: existing ? "shipping.update" : "shipping.create",
      entityType: "shipping_settings",
      entityId: row.id,
      metadata: { countryCode, changes: input, ...(existing ? { before: mapAdminShipping(existing) } : {}) },
    });

    return mapAdminShipping(row);
  });
}
