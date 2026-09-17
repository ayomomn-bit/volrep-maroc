import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog } from "../../db/schema/index.js";
import { __setLiryaClientForTests } from "../../lib/lirya/index.js";
import { LiryaError } from "../../lib/lirya/errors.js";
import type { LiryaClient } from "../../lib/lirya/types.js";
import { maskKey } from "../../services/admin/integrations.js";

function fakeClient(over: Partial<LiryaClient> = {}): LiryaClient {
  return {
    listPages: vi.fn(async () => ({ pages: [], nextCursor: null as string | null })) as never,
    getPage: vi.fn(async () => ({ status: 304 as const })) as never,
    editorUrl: () => null,
    ...over,
  };
}

describe("Admin integrations API", () => {
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
    __setLiryaClientForTests(undefined);
  });
  afterAll(async () => {
    await closeDb();
  });

  it("reports Lirya as not configured when no client is resolved, and COD as not connected", async () => {
    __setLiryaClientForTests(null);
    const res = await app.inject(asAdmin(staff, { method: "GET", url: "/api/admin/integrations" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().lirya.configured).toBe(false);
    expect(res.json().cod).toEqual({ status: "not_connected" });
  });

  it("never returns a raw API key — only a masked hint or null", async () => {
    __setLiryaClientForTests(fakeClient());
    const res = await app.inject(asAdmin(staff, { method: "GET", url: "/api/admin/integrations" }));
    const body = res.json();
    expect(body.lirya).not.toHaveProperty("apiKey");
    const hint: string | null = body.lirya.apiKeyHint;
    expect(hint === null || /^••••••.{0,4}$/.test(hint)).toBe(true);
    // If a key is configured in this environment, its full value must not
    // appear anywhere in the serialized response.
    const configuredKey = process.env.LIRYA_API_KEY;
    if (configuredKey) expect(JSON.stringify(body)).not.toContain(configuredKey);
  });

  it("owner test-connection succeeds against a reachable Lirya and is audited", async () => {
    const client = fakeClient({
      listPages: vi.fn(async () => ({ pages: [{ id: "pg_1" }], nextCursor: null })) as never,
    });
    __setLiryaClientForTests(client);

    const res = await app.inject(asAdmin(owner, { method: "POST", url: "/api/admin/integrations/lirya/test" }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, pageCount: 1 });
    expect(client.listPages).toHaveBeenCalledWith({ limit: 1 });

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "integration.lirya_test"));
    expect(audit).toMatchObject({ entityType: "integration" });
    expect(audit?.metadata).toMatchObject({ ok: true });
  });

  it("owner test-connection surfaces a Lirya auth failure without throwing", async () => {
    __setLiryaClientForTests(
      fakeClient({
        listPages: vi.fn(async () => {
          throw new LiryaError("unauthorized", "nope", { status: 401 });
        }) as never,
      }),
    );
    const res = await app.inject(asAdmin(owner, { method: "POST", url: "/api/admin/integrations/lirya/test" }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false, code: "unauthorized" });

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "integration.lirya_test"));
    expect(audit?.metadata).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("test-connection reports not_configured when Lirya has no client", async () => {
    __setLiryaClientForTests(null);
    const res = await app.inject(asAdmin(owner, { method: "POST", url: "/api/admin/integrations/lirya/test" }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false, code: "not_configured" });
  });

  it("staff cannot run the connection test (owner-only)", async () => {
    __setLiryaClientForTests(fakeClient());
    const res = await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/integrations/lirya/test" }));
    expect(res.statusCode).toBe(403);
  });

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/integrations" });
    expect(res.statusCode).toBe(401);
  });
});

describe("maskKey", () => {
  it("masks all but the last 4 characters, and fully masks short keys", () => {
    expect(maskKey(undefined)).toBeNull();
    expect(maskKey("")).toBeNull();
    expect(maskKey("short")).toBe("••••••••");
    expect(maskKey("abcdefghijklmnop")).toBe("••••••mnop");
  });
});
