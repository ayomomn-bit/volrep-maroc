import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { ADMIN_DEFAULT_PASSWORD, seedAdmin } from "../../test/admin.js";
import { closeDb } from "../../db/client.js";
import { env } from "../../config/env.js";

// Step 4 Phase 3 — M2: admin login password policy + per-account failed-login
// throttle. The throttle runs IN ADDITION to the per-IP @fastify/rate-limit
// route limiter (10 / 15min, unchanged — see global-rate-limit.test.ts and
// the assertion at the bottom of this file).

const WRONG_PASSWORD = "this-is-not-the-password"; // 23 chars — passes the schema, fails auth
const MAX_FAILURES = env.ADMIN_ACCOUNT_LOGIN_MAX_FAILURES; // 10 in test env

describe("admin login — M2 password policy + account throttle", () => {
  let app: FastifyInstance;
  let ipCounter = 0;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    ipCounter = 0;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  // A distinct source IP per call, so the per-IP route limiter never fires
  // and we isolate the ACCOUNT-level guard. `10.x.x.x` is not loopback, so
  // trustProxy: "loopback" (Step 1) keys request.ip on this socket address.
  function freshIp(): string {
    ipCounter += 1;
    return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
  }

  function attemptLogin(email: string, password: string, opts: { ip?: string } = {}) {
    return app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      remoteAddress: opts.ip ?? freshIp(),
      payload: { email, password },
    });
  }

  // ---- A) password policy -------------------------------------------

  it("rejects a password shorter than 12 characters as a 400 (not an auth attempt)", async () => {
    await seedAdmin({ email: "owner@volrep.test", password: ADMIN_DEFAULT_PASSWORD });

    const res = await attemptLogin("owner@volrep.test", "x".repeat(11));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts a 12-character password at the schema (correct 12-char password logs in)", async () => {
    await seedAdmin({ email: "owner@volrep.test", password: "abcdef123456" }); // exactly 12

    const res = await attemptLogin("owner@volrep.test", "abcdef123456");
    expect(res.statusCode).toBe(200);
  });

  it("still enforces the existing 200-character maximum", async () => {
    await seedAdmin({ email: "owner@volrep.test", password: ADMIN_DEFAULT_PASSWORD });

    const res = await attemptLogin("owner@volrep.test", "y".repeat(201));
    expect(res.statusCode).toBe(400);
  });

  // ---- B) per-account throttling -----------------------------------

  it("throttles one account after MAX_FAILURES failures — from many different IPs — and even a correct password is then temporarily blocked", async () => {
    await seedAdmin({ email: "target@volrep.test", password: ADMIN_DEFAULT_PASSWORD });

    for (let i = 0; i < MAX_FAILURES; i++) {
      const r = await attemptLogin("target@volrep.test", WRONG_PASSWORD); // each from a fresh IP
      expect(r.statusCode).toBe(401);
    }

    // The account is now throttled. A brand-new IP with the CORRECT password
    // is still rejected — the throttle is IP-independent.
    const blocked = await attemptLogin("target@volrep.test", ADMIN_DEFAULT_PASSWORD);
    expect(blocked.statusCode).toBe(401);
    expect(blocked.json().error.code).toBe("INVALID_CREDENTIALS");
  });

  it("a first account's failures never affect a different account", async () => {
    await seedAdmin({ email: "a@volrep.test", password: ADMIN_DEFAULT_PASSWORD });
    await seedAdmin({ email: "b@volrep.test", password: ADMIN_DEFAULT_PASSWORD });

    for (let i = 0; i < MAX_FAILURES; i++) {
      await attemptLogin("a@volrep.test", WRONG_PASSWORD);
    }

    expect((await attemptLogin("a@volrep.test", ADMIN_DEFAULT_PASSWORD)).statusCode).toBe(401); // a locked
    expect((await attemptLogin("b@volrep.test", ADMIN_DEFAULT_PASSWORD)).statusCode).toBe(200); // b fine
  });

  it("a successful login resets the account's failure state", async () => {
    await seedAdmin({ email: "c@volrep.test", password: ADMIN_DEFAULT_PASSWORD });

    for (let i = 0; i < MAX_FAILURES - 1; i++) {
      expect((await attemptLogin("c@volrep.test", WRONG_PASSWORD)).statusCode).toBe(401);
    }
    // One correct login clears the counter …
    expect((await attemptLogin("c@volrep.test", ADMIN_DEFAULT_PASSWORD)).statusCode).toBe(200);

    // … so MAX_FAILURES-1 further failures do NOT lock the account (without a
    // reset the total would be 2*(MAX_FAILURES-1) and it would be locked).
    for (let i = 0; i < MAX_FAILURES - 1; i++) {
      expect((await attemptLogin("c@volrep.test", WRONG_PASSWORD)).statusCode).toBe(401);
    }
    expect((await attemptLogin("c@volrep.test", ADMIN_DEFAULT_PASSWORD)).statusCode).toBe(200);
  });

  // ---- C) generic error / no oracle -------------------------------

  it("a throttled account, an unknown email, and a wrong password return the identical generic response", async () => {
    await seedAdmin({ email: "real@volrep.test", password: ADMIN_DEFAULT_PASSWORD });
    await seedAdmin({ email: "victim@volrep.test", password: ADMIN_DEFAULT_PASSWORD });

    for (let i = 0; i < MAX_FAILURES; i++) {
      await attemptLogin("victim@volrep.test", WRONG_PASSWORD);
    }

    const throttled = await attemptLogin("victim@volrep.test", ADMIN_DEFAULT_PASSWORD);
    const unknown = await attemptLogin("nobody-here@volrep.test", WRONG_PASSWORD);
    const wrongPw = await attemptLogin("real@volrep.test", WRONG_PASSWORD);

    expect(throttled.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrongPw.statusCode).toBe(401);

    // Byte-identical bodies — throttled state is not a distinguishable response.
    expect(throttled.json()).toEqual(unknown.json());
    expect(throttled.json()).toEqual(wrongPw.json());
    expect(throttled.json()).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });

    const body = JSON.stringify(throttled.json()).toLowerCase();
    expect(body).not.toMatch(/lock|throttl|too many|slow down|try again|attempt|rate limit/);
  });

  // ---- D) existing per-IP limiter unchanged -----------------------

  it("keeps the existing per-IP login limiter (10 / 15 min) active", async () => {
    await seedAdmin({ email: "owner@volrep.test", password: ADMIN_DEFAULT_PASSWORD });

    const SAME_IP = "203.0.113.9";
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await attemptLogin("owner@volrep.test", WRONG_PASSWORD, { ip: SAME_IP });
      codes.push(r.statusCode);
    }
    expect(codes).toContain(429); // the IP limiter still fires
    expect(codes.filter((c) => c === 401).length).toBeGreaterThanOrEqual(1);
  });

  // ---- E) junk-email flood stays bounded / responsive -------------
  // The real memory-bound proof is the SlidingWindowCounter `maxKeys` unit
  // test (src/lib/abuse-guard.test.ts). Here we just confirm a flood of
  // distinct junk identities still returns the generic 401 and the app
  // stays usable for a real account afterwards.

  it("a flood of distinct junk emails does not break login for a real account", async () => {
    for (let i = 0; i < 15; i++) {
      const r = await attemptLogin(`junk-${i}@nowhere.test`, WRONG_PASSWORD);
      expect(r.statusCode).toBe(401);
    }

    await seedAdmin({ email: "still-here@volrep.test", password: ADMIN_DEFAULT_PASSWORD });
    expect((await attemptLogin("still-here@volrep.test", ADMIN_DEFAULT_PASSWORD)).statusCode).toBe(200);
  });
});
