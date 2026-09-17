import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, storeSettings } from "../../db/schema/index.js";

describe("Admin store settings API", () => {
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

  it("returns the singleton settings row with defaults (any admin), creating it on first read", async () => {
    const res = await app.inject(asAdmin(staff, { method: "GET", url: "/api/admin/store-settings" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().settings).toMatchObject({
      storeName: "VOLREP",
      tagline: "",
      supportEmail: "",
      social: { instagram: "", tiktok: "", youtube: "" },
    });

    const rows = await db.select().from(storeSettings);
    expect(rows).toHaveLength(1);
  });

  it("owner updates identity fields and the change is audited", async () => {
    const res = await app.inject(
      asAdmin(owner, {
        method: "PUT",
        url: "/api/admin/store-settings",
        payload: {
          storeName: "VOLREP Maroc",
          tagline: "La récupération, simplifiée.",
          supportEmail: "support@volrep.com",
          socialInstagram: "https://instagram.com/volrep",
        },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().settings).toMatchObject({
      storeName: "VOLREP Maroc",
      tagline: "La récupération, simplifiée.",
      supportEmail: "support@volrep.com",
      social: { instagram: "https://instagram.com/volrep", tiktok: "", youtube: "" },
    });

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "store_settings.update"));
    expect(audit).toMatchObject({ entityType: "store_settings" });
    expect(audit?.metadata).toMatchObject({ fields: expect.arrayContaining(["storeName", "supportEmail"]) });
  });

  it("partial update keeps untouched fields", async () => {
    await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/store-settings", payload: { storeName: "First", tagline: "Keep me" } }),
    );
    const res = await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/store-settings", payload: { storeName: "Second" } }),
    );
    expect(res.json().settings.storeName).toBe("Second");
    expect(res.json().settings.tagline).toBe("Keep me");
  });

  it("staff cannot write settings (owner-only)", async () => {
    const res = await app.inject(
      asAdmin(staff, { method: "PUT", url: "/api/admin/store-settings", payload: { storeName: "Nope" } }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("rejects an invalid support email and a non-URL social link", async () => {
    const badEmail = await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/store-settings", payload: { supportEmail: "not-an-email" } }),
    );
    expect(badEmail.statusCode).toBe(400);

    const badUrl = await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/store-settings", payload: { socialTiktok: "tiktok.com/@volrep" } }),
    );
    expect(badUrl.statusCode).toBe(400);
  });

  it("accepts clearing a field back to empty", async () => {
    await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/store-settings", payload: { supportEmail: "support@volrep.com" } }),
    );
    const res = await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/store-settings", payload: { supportEmail: "" } }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().settings.supportEmail).toBe("");
  });

  it("rejects unknown fields and empty payloads", async () => {
    const unknown = await app.inject(
      asAdmin(owner, { method: "PUT", url: "/api/admin/store-settings", payload: { secretKey: "x" } }),
    );
    expect(unknown.statusCode).toBe(400);

    const empty = await app.inject(asAdmin(owner, { method: "PUT", url: "/api/admin/store-settings", payload: {} }));
    expect(empty.statusCode).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/store-settings" });
    expect(res.statusCode).toBe(401);
  });
});
