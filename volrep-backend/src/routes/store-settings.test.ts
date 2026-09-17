import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { closeDb, db } from "../db/client.js";
import { storeSettings, STORE_SETTINGS_ID } from "../db/schema/index.js";

describe("Storefront store-settings API (read-only)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("returns the default identity when nothing has been configured", async () => {
    const res = await app.inject(withAuth({ method: "GET", url: "/api/store-settings" }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      settings: {
        storeName: "VOLREP",
        tagline: "",
        supportEmail: "",
        social: { instagram: "", tiktok: "", youtube: "" },
      },
    });
  });

  it("reflects values set by an admin", async () => {
    await db.insert(storeSettings).values({
      id: STORE_SETTINGS_ID,
      storeName: "VOLREP Maroc",
      tagline: "La récupération, simplifiée.",
      supportEmail: "aide@volrep.ma",
      socialInstagram: "https://instagram.com/volrep",
      socialTiktok: "https://tiktok.com/@volrep",
      socialYoutube: "https://youtube.com/@volrep",
    });

    const res = await app.inject(withAuth({ method: "GET", url: "/api/store-settings" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().settings).toEqual({
      storeName: "VOLREP Maroc",
      tagline: "La récupération, simplifiée.",
      supportEmail: "aide@volrep.ma",
      social: {
        instagram: "https://instagram.com/volrep",
        tiktok: "https://tiktok.com/@volrep",
        youtube: "https://youtube.com/@volrep",
      },
    });
  });

  it("never exposes admin-only fields (updatedAt / updatedBy)", async () => {
    const res = await app.inject(withAuth({ method: "GET", url: "/api/store-settings" }));
    const body = JSON.stringify(res.json());
    expect(body).not.toContain("updatedAt");
    expect(body).not.toContain("updatedBy");
  });

  it("rejects a request with no internal API key", async () => {
    const res = await app.inject({ method: "GET", url: "/api/store-settings" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a request with a wrong internal API key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/store-settings",
      headers: { "x-internal-api-key": "not-the-key" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("does not accept an admin session cookie in place of the internal key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/store-settings",
      cookies: { volrep_admin_session: "anything" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("is read-only — other verbs are not routed", async () => {
    const put = await app.inject(withAuth({ method: "PUT", url: "/api/store-settings", payload: { storeName: "x" } }));
    expect(put.statusCode).toBe(404);

    const rows = await db.select().from(storeSettings).where(eq(storeSettings.id, STORE_SETTINGS_ID));
    // The GET may have lazily created the row; its content must still be default.
    if (rows[0]) expect(rows[0].storeName).toBe("VOLREP");
  });
});
