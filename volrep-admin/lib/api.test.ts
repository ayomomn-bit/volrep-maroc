import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, setUnauthenticatedHandler } from "./api";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  setUnauthenticatedHandler(null);
});

describe("api client", () => {
  it("sends credentials: include and never an x-internal-api-key", async () => {
    const f = mockFetch(200, { ok: true });
    vi.stubGlobal("fetch", f);
    await api.get("/api/admin/dashboard");
    const [, init] = f.mock.calls[0];
    expect(init.credentials).toBe("include");
    const headerKeys = Object.keys(init.headers ?? {}).map((k) => k.toLowerCase());
    expect(headerKeys).not.toContain("x-internal-api-key");
    expect(headerKeys).not.toContain("authorization");
  });

  it("calls the Lirya page picker through the backend with no bearer / API key in the browser", async () => {
    const f = mockFetch(200, { pages: [], nextCursor: null, liryaConfigured: true });
    vi.stubGlobal("fetch", f);
    await api.get("/api/admin/lirya/pages", { q: "recovery" });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("/api/admin/lirya/pages");
    expect(String(url)).toContain("q=recovery");
    const headerKeys = Object.keys(init.headers ?? {}).map((k: string) => k.toLowerCase());
    expect(headerKeys).not.toContain("authorization");
    expect(headerKeys).not.toContain("x-internal-api-key");
    expect(init.credentials).toBe("include");
  });

  it("maps a backend error envelope to ApiError with code + message", async () => {
    vi.stubGlobal("fetch", mockFetch(422, { error: { code: "INVALID_TRANSITION", message: "Cannot move…" } }));
    await expect(api.patch("/x")).rejects.toMatchObject({
      status: 422,
      code: "INVALID_TRANSITION",
      message: "Cannot move…",
    });
  });

  it("throws UNAUTHENTICATED and fires the global handler on 401", async () => {
    vi.stubGlobal("fetch", mockFetch(401, { error: { code: "UNAUTHORIZED" } }));
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    await expect(api.get("/api/admin/orders")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("suppresses the global 401 handler when asked (login page probe)", async () => {
    vi.stubGlobal("fetch", mockFetch(401, {}));
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    await expect(api.get("/api/admin/auth/me", undefined, { suppressAuthRedirect: true })).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("reports a friendly network error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
    await expect(api.get("/x")).rejects.toMatchObject({ code: "NETWORK" });
  });
});
