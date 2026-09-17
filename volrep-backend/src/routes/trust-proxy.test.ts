import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../test/test-app.js";

// Step 1A — trustProxy / client IP.
//
// The test env leaves TRUST_PROXY at its default ("loopback"), which is the
// production posture: only a reverse proxy on the same host may set the IP
// that rate limiting keys on. A probe route is attached to the app so we can
// read request.ip directly without depending on any real endpoint.
describe("trustProxy — client IP derivation", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
    app.get("/__probe/ip", (request) => ({ ip: request.ip, ips: request.ips }));
  });

  afterEach(async () => {
    await app.close();
  });

  it("uses the raw socket address when there is no forwarding header", async () => {
    const response = await app.inject({ method: "GET", url: "/__probe/ip", remoteAddress: "203.0.113.10" });
    expect(response.json().ip).toBe("203.0.113.10");
  });

  it("an untrusted (direct) client cannot spoof its IP via X-Forwarded-For", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/__probe/ip",
      remoteAddress: "198.51.100.7", // not loopback → not a trusted proxy
      headers: { "x-forwarded-for": "10.9.8.7" },
    });
    // The spoofed header is ignored; the real socket address wins.
    expect(response.json().ip).toBe("198.51.100.7");
  });

  it("trusts X-Forwarded-For only from the loopback reverse proxy", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/__probe/ip",
      remoteAddress: "127.0.0.1", // the co-located Nginx/Caddy
      headers: { "x-forwarded-for": "41.92.0.5" }, // the real shopper
    });
    expect(response.json().ip).toBe("41.92.0.5");
  });

  it("keeps distinct forwarded clients distinct behind the trusted proxy", async () => {
    const a = await app.inject({
      method: "GET",
      url: "/__probe/ip",
      remoteAddress: "127.0.0.1",
      headers: { "x-forwarded-for": "41.92.0.5" },
    });
    const b = await app.inject({
      method: "GET",
      url: "/__probe/ip",
      remoteAddress: "127.0.0.1",
      headers: { "x-forwarded-for": "196.200.1.9" },
    });
    expect(a.json().ip).toBe("41.92.0.5");
    expect(b.json().ip).toBe("196.200.1.9");
    expect(a.json().ip).not.toBe(b.json().ip);
  });
});
