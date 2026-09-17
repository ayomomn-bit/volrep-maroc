import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The storefront data layer is server-only: in a plain vitest (node)
// context the `server-only` guard throws and `next/headers` is unavailable,
// so both are stubbed. `next/headers` is backed by a mutable bag so each
// test can set the inbound forwarding header it wants.
vi.mock("server-only", () => ({}));

const { headerBag } = vi.hoisted(() => ({ headerBag: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerBag.get(name.toLowerCase()) ?? null,
  }),
}));

import { findOrderForTracking } from "./orders";

// Step 4 H2 — GET /api/orders/track must receive the real customer IP via
// x-forwarded-for so the backend's per-route brute-force limiter keys on
// the visitor, not on this server's single outbound address (same fix the
// COD path already carries).
describe("findOrderForTracking — client IP forwarding", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    headerBag.clear();
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "not_found" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function sentHeaders(): Record<string, string> {
    const init = (fetchMock.mock.calls[0]?.[1] ?? {}) as { headers?: Record<string, string> };
    return init.headers ?? {};
  }

  it("passes the incoming x-forwarded-for through to GET /api/orders/track", async () => {
    headerBag.set("x-forwarded-for", "41.92.10.5");

    await findOrderForTracking("1001", "buyer@example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/orders/track");
    expect(sentHeaders()["x-forwarded-for"]).toBe("41.92.10.5");
    // H2 must not weaken auth — the internal key is still attached.
    expect(sentHeaders()["x-internal-api-key"]).toBeTruthy();
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    headerBag.set("x-real-ip", "196.200.1.9");

    await findOrderForTracking("1001", "buyer@example.com");

    expect(sentHeaders()["x-forwarded-for"]).toBe("196.200.1.9");
  });

  it("sends no x-forwarded-for when the incoming request carries neither header", async () => {
    await findOrderForTracking("1001", "buyer@example.com");

    expect(sentHeaders()["x-forwarded-for"]).toBeUndefined();
  });
});
