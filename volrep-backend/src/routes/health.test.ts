import { afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { closeDb } from "../db/client.js";

describe("GET /health", () => {
  let app: FastifyInstance;

  it("reports ok with a minimal body and no infrastructure detail (L4)", async () => {
    app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    // Hardened: just `{ status }` — the probe never discloses which
    // dependency, driver, version or error text to an unauthenticated
    // caller (security hardening — Step 4 L4). Orchestrators key on the
    // 200 / 503 status code and this one field.
    expect(response.json()).toEqual({ status: "ok" });
    expect(Object.keys(response.json())).toEqual(["status"]);
    expect(JSON.stringify(response.json())).not.toMatch(
      /database|postgres|connect|driver|version|unreachable/i,
    );
  });

  afterAll(async () => {
    await app.close();
    await closeDb();
  });
});
