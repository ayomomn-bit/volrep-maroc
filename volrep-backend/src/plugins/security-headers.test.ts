import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { closeDb } from "../db/client.js";
import { hstsHeaderValue } from "./security-headers.js";

describe("backend security headers", () => {
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

  it("sets the baseline headers on an ordinary JSON response", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-site");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["permissions-policy"]).toContain("geolocation=()");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("uses same-site (not same-origin) CORP on the API so the admin SPA's cross-origin-but-same-site fetch is not blocked by the browser", async () => {
    // admin.<domain> calls api.<domain> directly from the browser
    // (volrep-admin/next.config.ts) — cross-origin but same-site. CORP is
    // enforced by the browser on any cross-origin response even after CORS
    // approves it, so "same-origin" here would silently block every admin
    // API call while every app.inject()-based test still passed.
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-site");
    expect(res.headers["cross-origin-resource-policy"]).not.toBe("same-origin");
  });

  it("does not disclose the framework (no x-powered-by)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("still sets headers on an error response", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/orders" }); // 401
    expect(res.statusCode).toBe(401);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
  });

  it("the API CSP has no wildcard and no script-src at all (default-src 'none')", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).not.toContain("*");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("does not send HSTS outside production (localhost dev must keep working)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("hstsHeaderValue: production only, no preload", () => {
    expect(hstsHeaderValue("development", 63072000)).toBeNull();
    expect(hstsHeaderValue("test", 63072000)).toBeNull();
    expect(hstsHeaderValue("production", 0)).toBeNull();
    expect(hstsHeaderValue("production", 63072000)).toBe("max-age=63072000; includeSubDomains");
    expect(hstsHeaderValue("production", 63072000)).not.toContain("preload");
  });
});
