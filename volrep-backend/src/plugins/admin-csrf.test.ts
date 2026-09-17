import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { ADMIN_DEFAULT_PASSWORD, asAdmin, loginAdmin, seedAdmin } from "../test/admin.js";
import { closeDb } from "../db/client.js";

// Step 2 §6 — CSRF Origin/Referer guard on state-changing /api/admin/*.
// The test env leaves ADMIN_TRUSTED_ORIGINS unset, so the allow-list is
// [CORS_ADMIN_ORIGIN] = "http://localhost:3001" (from .env.test).
const TRUSTED = "http://localhost:3001";
const EVIL = "https://evil.example";

describe("admin CSRF — Origin/Referer guard", () => {
  let app: FastifyInstance;
  let sessionId: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    const admin = await seedAdmin({ email: "owner@volrep.test" });
    sessionId = await loginAdmin(app, admin.email);
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("rejects a state-changing admin request from an untrusted Origin (403), before the handler runs", async () => {
    const res = await app.inject(
      asAdmin(sessionId, {
        method: "POST",
        url: "/api/admin/auth/logout",
        headers: { origin: EVIL },
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("CSRF_ORIGIN_REJECTED");
  });

  it("rejects when only an untrusted Referer is present", async () => {
    const res = await app.inject(
      asAdmin(sessionId, {
        method: "POST",
        url: "/api/admin/auth/logout",
        headers: { referer: `${EVIL}/dashboard` },
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("CSRF_ORIGIN_REJECTED");
  });

  it("allows a state-changing admin request from the configured trusted Origin", async () => {
    const res = await app.inject(
      asAdmin(sessionId, {
        method: "POST",
        url: "/api/admin/auth/logout",
        headers: { origin: TRUSTED },
      }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("allows a state-changing request with no Origin and no Referer (non-browser caller)", async () => {
    const res = await app.inject(
      asAdmin(sessionId, { method: "POST", url: "/api/admin/auth/logout" }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("does not check safe methods — GET with an evil Origin still works", async () => {
    const res = await app.inject(
      asAdmin(sessionId, {
        method: "GET",
        url: "/api/admin/auth/me",
        headers: { origin: EVIL },
      }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("guards login itself against login-CSRF (evil Origin → 403, credentials never checked)", async () => {
    await seedAdmin({ email: "victim@volrep.test" });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: EVIL },
      payload: { email: "victim@volrep.test", password: ADMIN_DEFAULT_PASSWORD },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("CSRF_ORIGIN_REJECTED");
    expect(res.cookies.find((c) => c.name === "volrep_admin_session")).toBeUndefined();
  });

  it("treats a literal 'null' Origin as untrusted", async () => {
    const res = await app.inject(
      asAdmin(sessionId, {
        method: "POST",
        url: "/api/admin/auth/logout",
        headers: { origin: "null", referer: `${EVIL}/x` },
      }),
    );
    expect(res.statusCode).toBe(403);
  });
});
