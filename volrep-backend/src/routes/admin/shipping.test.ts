import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { seedShipping } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, shippingSettings } from "../../db/schema/index.js";

describe("Admin shipping settings API", () => {
  let app: FastifyInstance;
  let owner: string;
  let staff: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    owner = (await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" })).sessionId;
    staff = (await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" })).sessionId;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("lists shipping settings (any admin)", async () => {
    await seedShipping({ countryCode: "MA", flatRateAmount: "30.00" });
    const res = await app.inject(asAdmin(staff, { method: "GET", url: "/api/admin/shipping-settings" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().countries).toHaveLength(1);
    expect(res.json().countries[0]).toMatchObject({ countryCode: "MA", flatRate: { amount: "30.00", currencyCode: "MAD" } });
  });

  it("owner creates a new country config (upsert) and it is audited", async () => {
    const res = await app.inject(
      asAdmin(owner, {
        method: "PUT",
        url: "/api/admin/shipping-settings/fr",
        payload: { active: true, flatRateAmount: "0", currency: "EUR", shippingTimeMinDays: 4, shippingTimeMaxDays: 8 },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().country).toMatchObject({ countryCode: "FR", currency: "EUR", shippingTimeDays: { min: 4, max: 8 } });

    const [row] = await db.select().from(shippingSettings).where(eq(shippingSettings.countryCode, "FR"));
    expect(row?.active).toBe(true);

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "shipping.create"));
    expect(audit).toMatchObject({ entityType: "shipping_settings" });
  });

  it("owner updates an existing country (partial), keeping untouched fields", async () => {
    await seedShipping({ countryCode: "MA", flatRateAmount: "30.00", shippingTimeMinDays: 7 });

    const res = await app.inject(
      asAdmin(owner, {
        method: "PUT",
        url: "/api/admin/shipping-settings/MA",
        payload: { active: false },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().country.active).toBe(false);
    expect(res.json().country.flatRate.amount).toBe("30.00");
    expect(res.json().country.shippingTimeDays.min).toBe(7);

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "shipping.update"));
    expect(audit?.metadata).toMatchObject({ countryCode: "MA", changes: { active: false } });
  });

  it("staff cannot change shipping settings (owner-only)", async () => {
    const res = await app.inject(
      asAdmin(staff, { method: "PUT", url: "/api/admin/shipping-settings/MA", payload: { active: true, flatRateAmount: "10.00" } }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("validates the country code and money format", async () => {
    const badCountry = await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/shipping-settings/morocco", payload: { active: true } }),
    );
    expect(badCountry.statusCode).toBe(400);

    const badMoney = await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/shipping-settings/MA", payload: { flatRateAmount: "-3" } }),
    );
    expect(badMoney.statusCode).toBe(400);
  });
});
