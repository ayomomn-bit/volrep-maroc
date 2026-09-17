import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { ADMIN_DEFAULT_PASSWORD, asAdmin, loginAdmin, seedAdmin } from "../../test/admin.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, adminSessions } from "../../db/schema/index.js";
import { ADMIN_SESSION_COOKIE, hashSessionToken } from "../../lib/admin-auth.js";
import { purgeExpiredSessions } from "../../services/admin/auth.js";

describe("Admin auth API", () => {
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

  it("logs in with valid credentials, sets an httpOnly session cookie, never returns the hash", async () => {
    await seedAdmin({ email: "owner@volrep.test", role: "owner", password: "a-good-password-1" });

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { email: "owner@volrep.test", password: "a-good-password-1" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.admin).toMatchObject({ email: "owner@volrep.test", role: "owner" });
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|password_hash|\$argon2/);

    const cookie = res.cookies.find((c) => c.name === ADMIN_SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite?.toLowerCase()).toBe("strict");
    expect(cookie?.path).toBe("/api/admin");
    // NODE_ENV=test → not production → Secure omitted so localhost dev works.
    expect(cookie?.secure ?? false).toBe(false);
    // Raw session token: 256 bits of CSPRNG output, hex-encoded (M1).
    expect(cookie?.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects an unknown email and a wrong password with the identical generic error", async () => {
    await seedAdmin({ email: "real@volrep.test", password: "the-real-password-9" });

    const unknown = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { email: "ghost@volrep.test", password: "not-the-password-1" },
    });
    const wrongPw = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { email: "real@volrep.test", password: "also-not-the-password" },
    });

    expect(unknown.statusCode).toBe(401);
    expect(wrongPw.statusCode).toBe(401);
    // Byte-identical response for both failure modes — the login endpoint
    // is never an oracle for "does this account exist".
    expect(unknown.json()).toEqual(wrongPw.json());
    expect(unknown.json().error.code).toBe("INVALID_CREDENTIALS");
    expect(unknown.json().error.message).not.toMatch(/no such|not found|unknown|does ?n['o]t exist|disabled/i);
  });

  it("persists the session: /me works with the cookie from login", async () => {
    const admin = await seedAdmin({ email: "staff@volrep.test", role: "staff" });
    const sessionId = await loginAdmin(app, admin.email);

    const me = await app.inject(asAdmin(sessionId, { method: "GET", url: "/api/admin/auth/me" }));
    expect(me.statusCode).toBe(200);
    expect(me.json().admin).toMatchObject({ email: "staff@volrep.test", role: "staff" });
    expect(JSON.stringify(me.json())).not.toMatch(/\$argon2|passwordHash/);
  });

  it("logout deletes the session row and the cookie stops working", async () => {
    const admin = await seedAdmin({ email: "owner@volrep.test" });
    const sessionId = await loginAdmin(app, admin.email);

    const out = await app.inject(asAdmin(sessionId, { method: "POST", url: "/api/admin/auth/logout" }));
    expect(out.statusCode).toBe(200);

    const rows = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.id, hashSessionToken(sessionId)));
    expect(rows).toHaveLength(0);

    const after = await app.inject(asAdmin(sessionId, { method: "GET", url: "/api/admin/auth/me" }));
    expect(after.statusCode).toBe(401);
  });

  it("session fixation: a pre-login session id is never adopted; each login mints a fresh id", async () => {
    const admin = await seedAdmin({ email: "owner@volrep.test" });

    // Attacker plants a session id in the victim's browser before login.
    const plantedId = "11111111-1111-4111-8111-111111111111";

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: "http://localhost:3001" },
      cookies: { [ADMIN_SESSION_COOKIE]: plantedId },
      payload: { email: admin.email, password: ADMIN_DEFAULT_PASSWORD },
    });
    expect(res.statusCode).toBe(200);

    const issued = res.cookies.find((c) => c.name === ADMIN_SESSION_COOKIE)?.value;
    expect(issued).toBeDefined();
    // The cookie is REPLACED with a server-generated token, never the planted one.
    expect(issued).not.toBe(plantedId);
    expect(issued).toMatch(/^[0-9a-f]{64}$/);

    // The planted id never became valid.
    const planted = await app.inject(asAdmin(plantedId, { method: "GET", url: "/api/admin/auth/me" }));
    expect(planted.statusCode).toBe(401);

    // Two logins in a row produce two different session ids (no reuse).
    const again = await loginAdmin(app, admin.email);
    expect(again).not.toBe(issued);
  });

  it("rejects an unauthenticated admin request (no cookie) with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/orders" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a forged / expired session cookie", async () => {
    const admin = await seedAdmin({ email: "owner@volrep.test" });
    const sessionId = await loginAdmin(app, admin.email);

    // random uuid, never issued
    const forged = await app.inject(
      asAdmin("00000000-0000-4000-8000-000000000000", { method: "GET", url: "/api/admin/auth/me" }),
    );
    expect(forged.statusCode).toBe(401);

    // expire the real one in the DB (row is keyed by the hashed token)
    const hashedId = hashSessionToken(sessionId);
    await db.update(adminSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(adminSessions.id, hashedId));
    const expired = await app.inject(asAdmin(sessionId, { method: "GET", url: "/api/admin/auth/me" }));
    expect(expired.statusCode).toBe(401);
    // expired session should have been pruned
    expect(await db.select().from(adminSessions).where(eq(adminSessions.id, hashedId))).toHaveLength(0);
  });

  it("enforces role authorization: staff cannot hit an owner-only route", async () => {
    const staff = await seedAdmin({ email: "staff@volrep.test", role: "staff" });
    const staffSession = await loginAdmin(app, staff.email);

    const res = await app.inject(
      asAdmin(staffSession, {
        method: "PUT",
        url: "/api/admin/shipping-settings/MA",
        payload: { active: true, flatRateAmount: "30.00" },
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("does NOT accept the storefront internal API key as admin auth", async () => {
    await seedAdmin({ email: "owner@volrep.test" });
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/orders",
      headers: { "x-internal-api-key": "test-internal-api-key-not-a-real-secret" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("writes an audit entry on login and logout (no token/password in metadata)", async () => {
    const admin = await seedAdmin({ email: "owner@volrep.test" });
    const sessionId = await loginAdmin(app, admin.email);
    await app.inject(asAdmin(sessionId, { method: "POST", url: "/api/admin/auth/logout" }));

    const entries = await db.select().from(adminAuditLog).where(eq(adminAuditLog.adminUserId, admin.id));
    const actions = entries.map((e) => e.action);
    expect(actions).toContain("admin.login");
    expect(actions).toContain("admin.logout");
    expect(JSON.stringify(entries)).not.toMatch(/\$argon2|password|battery|staple|token/i);
  });

  // Security hardening — Step 4 M1: admin session tokens are hashed at rest.
  // A DB leak of admin_sessions.id must not yield a usable bearer token.
  describe("session token hashing at rest (M1)", () => {
    it("stores only SHA-256(cookie token) in admin_sessions.id, never the raw token", async () => {
      const admin = await seedAdmin({ email: "owner@volrep.test" });
      const cookieToken = await loginAdmin(app, admin.email);

      const rows = await db.select().from(adminSessions);
      expect(rows).toHaveLength(1);
      const storedId = rows[0]!.id;

      // The persisted id is the hash — different from the cookie, and
      // exactly SHA-256(cookie token).
      expect(storedId).not.toBe(cookieToken);
      expect(storedId).toBe(hashSessionToken(cookieToken));
      expect(storedId).toMatch(/^[0-9a-f]{64}$/);

      // The raw token appears nowhere in the row.
      expect(JSON.stringify(rows[0])).not.toContain(cookieToken);
    });

    it("accepts the raw cookie token but rejects the stored hash used as a cookie", async () => {
      const admin = await seedAdmin({ email: "owner@volrep.test" });
      const cookieToken = await loginAdmin(app, admin.email);
      const storedId = (await db.select().from(adminSessions))[0]!.id;

      const ok = await app.inject(asAdmin(cookieToken, { method: "GET", url: "/api/admin/auth/me" }));
      expect(ok.statusCode).toBe(200);

      // The value an attacker would read straight out of the DB does not work.
      const replay = await app.inject(asAdmin(storedId, { method: "GET", url: "/api/admin/auth/me" }));
      expect(replay.statusCode).toBe(401);
    });

    it("logout with the raw cookie token deletes the hashed session row", async () => {
      const admin = await seedAdmin({ email: "owner@volrep.test" });
      const cookieToken = await loginAdmin(app, admin.email);
      const hashedId = hashSessionToken(cookieToken);

      expect(await db.select().from(adminSessions).where(eq(adminSessions.id, hashedId))).toHaveLength(1);

      const out = await app.inject(asAdmin(cookieToken, { method: "POST", url: "/api/admin/auth/logout" }));
      expect(out.statusCode).toBe(200);

      expect(await db.select().from(adminSessions).where(eq(adminSessions.id, hashedId))).toHaveLength(0);
    });

    it("purgeExpiredSessions still removes expired hashed rows and leaves live ones", async () => {
      const admin = await seedAdmin({ email: "owner@volrep.test" });
      const liveToken = await loginAdmin(app, admin.email);
      const staleToken = await loginAdmin(app, admin.email);

      await db
        .update(adminSessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(adminSessions.id, hashSessionToken(staleToken)));

      const purged = await purgeExpiredSessions();
      expect(purged).toBe(1);

      const remaining = await db.select().from(adminSessions);
      expect(remaining.map((r) => r.id)).toEqual([hashSessionToken(liveToken)]);

      // The live session still authenticates after the purge.
      const me = await app.inject(asAdmin(liveToken, { method: "GET", url: "/api/admin/auth/me" }));
      expect(me.statusCode).toBe(200);
    });

    it("ignores a malformed session cookie without a DB lookup", async () => {
      await seedAdmin({ email: "owner@volrep.test" });
      // Old-style raw uuid (what a pre-M1 cookie looked like) — no longer valid.
      const res = await app.inject(
        asAdmin("11111111-1111-4111-8111-111111111111", { method: "GET", url: "/api/admin/auth/me" }),
      );
      expect(res.statusCode).toBe(401);
    });
  });
});
