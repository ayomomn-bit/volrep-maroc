import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../test/test-app.js";
import { closeDb } from "../../db/client.js";
import { getMediaStorage, __setMediaStorage } from "../../lib/media-storage/index.js";
import { PNG_1PX, GIF_1PX } from "../../test/media.js";

// Step 3 §9 / §10 — the media-serving route (@fastify/static at /media/*
// with the local driver). Uses the REAL LocalMediaStorage so files are
// actually written to disk and served back.
describe("media serving (/media/*)", () => {
  let app: FastifyInstance;
  const written: string[] = [];

  beforeEach(async () => {
    __setMediaStorage(null); // use the real local driver
    app = await createTestApp();
  });

  afterEach(async () => {
    const storage = getMediaStorage();
    for (const key of written.splice(0)) await storage.delete(key).catch(() => {});
    await app.close();
  });

  afterAll(async () => {
    await closeDb();
  });

  async function store(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await getMediaStorage().put(key, bytes, contentType);
    written.push(key);
  }

  it("serves a stored PNG with the correct Content-Type and hardening headers", async () => {
    const key = "products/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png";
    await store(key, PNG_1PX, "image/png");

    const res = await app.inject({ method: "GET", url: `/media/${key}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\/png/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("sandbox");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.rawPayload.equals(PNG_1PX)).toBe(true);
  });

  it("serves a stored GIF as image/gif (a GIF/HTML polyglot can never render as HTML)", async () => {
    const key = "products/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.gif";
    const polyglot = Buffer.concat([GIF_1PX, Buffer.from("<html><script>alert(1)</script></html>")]);
    await store(key, polyglot, "image/gif");

    const res = await app.inject({ method: "GET", url: `/media/${key}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\/gif/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("does not serve arbitrary files via path traversal", async () => {
    for (const url of [
      "/media/../../../../etc/passwd",
      "/media/..%2f..%2f..%2f..%2fetc%2fpasswd",
      "/media/products/../../../../etc/passwd",
      "/media/%2e%2e/%2e%2e/etc/passwd",
    ]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).not.toBe(200);
      expect(res.body).not.toMatch(/root:.*:0:0:/);
    }
  });

  it("404s an unknown media key without leaking a filesystem path", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/media/products/deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef.png",
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.stringify(res.headers) + res.body).not.toMatch(/\/(Users|home|srv|var)\//);
  });
});
