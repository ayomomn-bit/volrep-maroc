import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../test/test-app.js";
import { adminAllowedOrigins } from "../config/env.js";

// Step 2 §7 — admin CORS: explicit origins only, credentials on, never a
// wildcard. Test env: ADMIN_TRUSTED_ORIGINS unset → ["http://localhost:3001"].
describe("admin CORS", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it("reflects only the configured origin, with credentials, on a preflight", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/admin/orders",
      headers: {
        origin: "http://localhost:3001",
        "access-control-request-method": "GET",
      },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3001");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("never answers with a wildcard Access-Control-Allow-Origin", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/admin/orders",
      headers: { origin: "http://localhost:3001", "access-control-request-method": "GET" },
    });
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("does not grant CORS access to an unlisted origin", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/admin/orders",
      headers: { origin: "https://evil.example", "access-control-request-method": "GET" },
    });
    expect(res.headers["access-control-allow-origin"]).not.toBe("https://evil.example");
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("adminAllowedOrigins() never contains a wildcard", () => {
    expect(adminAllowedOrigins()).not.toContain("*");
    expect(adminAllowedOrigins().length).toBeGreaterThan(0);
  });
});
