import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../test/test-app.js";
import { AppError } from "../lib/errors.js";

// Step 2 §11 — production error responses must not leak internals.
describe("error handler — information leakage", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
    app.get("/__probe/throw-native", () => {
      // Simulates an unexpected failure deep in a service (e.g. a driver
      // error) with a revealing message + stack.
      throw new Error("connect ECONNREFUSED 127.0.0.1:5432 at /srv/volrep/src/db/client.ts:8:19");
    });
    app.get("/__probe/throw-app", () => {
      throw AppError.badRequest("Human-readable, safe message.");
    });
  });
  afterEach(async () => {
    await app.close();
  });

  it("collapses an unexpected error to a generic 500 with no stack / path / DB detail", async () => {
    const res = await app.inject({ method: "GET", url: "/__probe/throw-native" });
    expect(res.statusCode).toBe(500);

    const body = res.json();
    expect(body).toEqual({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });

    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/ECONNREFUSED|5432|\/srv\/|client\.ts|at .*:\d+:\d+|stack/i);
  });

  it("still returns a useful message for a deliberate AppError", async () => {
    const res = await app.inject({ method: "GET", url: "/__probe/throw-app" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({ code: "BAD_REQUEST", message: "Human-readable, safe message." });
  });

  it("does not leak a stack trace or the framework in the response headers", async () => {
    const res = await app.inject({ method: "GET", url: "/__probe/throw-native" });
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(JSON.stringify(res.headers)).not.toMatch(/stack|ECONNREFUSED/i);
  });
});
