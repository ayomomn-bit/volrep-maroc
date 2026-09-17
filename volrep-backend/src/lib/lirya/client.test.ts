import { describe, expect, it, vi } from "vitest";
import { createLiryaClient } from "./client.js";
import { LiryaError } from "./errors.js";
import type { LiryaLogger, LiryaPage } from "./types.js";

const API_KEY = "lirya-secret-key-abcdefghijklmnop";
const BASE = "https://lirya.test";

const page = (over: Partial<LiryaPage> = {}): LiryaPage => ({
  id: "pg_123",
  type: "landing",
  slug: "recovery",
  name: "Recovery landing",
  status: "published",
  template: "classic",
  url: "https://lirya.test/p/recovery",
  external_ref: { product_id: "prod-1" },
  version: 3,
  etag: '"pg_123:3"',
  content_source: "legacy_html",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  published_at: "2026-02-01T00:00:00Z",
  ...over,
});

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(status === 304 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function spyLogger(): LiryaLogger & { lines: string[] } {
  const lines: string[] = [];
  const rec = (obj: Record<string, unknown>, msg: string) => lines.push(JSON.stringify(obj) + " " + msg);
  return { lines, info: rec, warn: rec, error: rec };
}

function makeClient(fetchImpl: typeof fetch, over: Partial<Parameters<typeof createLiryaClient>[0]> = {}) {
  const logger = spyLogger();
  const client = createLiryaClient({
    baseUrl: BASE,
    apiKey: API_KEY,
    adminBaseUrl: "https://admin.lirya.test",
    timeoutMs: 50,
    maxRetries: 0,
    fetchImpl,
    logger,
    ...over,
  });
  return { client, logger };
}

describe("Lirya client", () => {
  it("lists pages from the real envelope (data + pagination), key only in the Authorization header", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      expect(u).toContain("/api/v1/pages?");
      expect(u).toContain("type=landing");
      expect(u).toContain("status=published");
      expect(u).not.toContain(API_KEY); // key never in the URL
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
      // Real Lirya V1 contract shape.
      return jsonResponse(200, {
        data: [page(), page({ id: "pg_456", name: "Second" })],
        pagination: { limit: 25, has_more: true, next_cursor: "cur-2" },
      });
    });
    const { client, logger } = makeClient(fetchImpl as unknown as typeof fetch);

    const res = await client.listPages({ type: "landing", status: "published" });
    expect(res.pages).toHaveLength(2);
    expect(res.nextCursor).toBe("cur-2"); // pagination.next_cursor
    expect(logger.lines.join("\n")).not.toContain(API_KEY);
  });

  it("returns nextCursor: null when pagination.has_more is false (even if a cursor is echoed)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { data: [page()], pagination: { limit: 25, has_more: false, next_cursor: "ignored" } }),
    );
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    expect((await client.listPages()).nextCursor).toBeNull();
  });

  it("still reads a legacy { pages, next_cursor } fallback shape", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { pages: [page()], next_cursor: "cur-fallback" }));
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    const res = await client.listPages();
    expect(res.pages).toHaveLength(1);
    expect(res.nextCursor).toBe("cur-fallback");
  });

  it("sends slug / product_id / purpose / updated_since filters to Lirya", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      expect(u.searchParams.get("type")).toBe("landing");
      expect(u.searchParams.get("status")).toBe("published");
      expect(u.searchParams.get("slug")).toBe("douche");
      expect(u.searchParams.get("product_id")).toBe("prod-42");
      expect(u.searchParams.get("purpose")).toBe("acquisition");
      expect(u.searchParams.get("updated_since")).toBe("2026-08-01T00:00:00Z");
      expect(u.searchParams.get("limit")).toBe("10");
      return jsonResponse(200, { data: [], pagination: { limit: 10, has_more: false, next_cursor: null } });
    });
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    await client.listPages({
      type: "landing",
      status: "published",
      slug: "douche",
      productId: "prod-42",
      purpose: "acquisition",
      updatedSince: "2026-08-01T00:00:00Z",
      limit: 10,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("getPage returns { status: 200, page } on a fresh fetch", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, page(), { "x-request-id": "req-1" }));
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    const res = await client.getPage("pg_123");
    expect(res).toMatchObject({ status: 200, page: { id: "pg_123", status: "published" } });
  });

  it("getPage sends If-None-Match and returns { status: 304 } when unchanged", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("if-none-match")).toBe('W/"v3"');
      return new Response(null, { status: 304, headers: { "x-request-id": "req-304" } });
    });
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    expect(await client.getPage("pg_123", { etag: 'W/"v3"' })).toEqual({ status: 304 });
  });

  it("maps 404 to LiryaError('page_not_found') and captures X-Request-Id", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ title: "Not found", detail: "no such page" }), {
        status: 404,
        headers: { "content-type": "application/problem+json", "x-request-id": "req-404" },
      }),
    );
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPage("pg_x")).rejects.toMatchObject({
      name: "LiryaError",
      code: "page_not_found",
      requestId: "req-404",
      problem: { detail: "no such page" },
    });
  });

  it("maps 401 and 403 to typed errors", async () => {
    const c401 = makeClient((async () => jsonResponse(401, { title: "unauth" })) as unknown as typeof fetch).client;
    await expect(c401.getPage("pg_1")).rejects.toMatchObject({ code: "unauthorized" });
    const c403 = makeClient((async () => jsonResponse(403, { title: "scope" })) as unknown as typeof fetch).client;
    await expect(c403.getPage("pg_1")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("honours Retry-After on 429 and surfaces retryAfterMs", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, { title: "slow down" }, { "retry-after": "0" }));
    const { client } = makeClient(fetchImpl as unknown as typeof fetch, { maxRetries: 1 });
    await expect(client.listPages()).rejects.toMatchObject({ code: "rate_limited", retryAfterMs: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2); // original + one retry
  });

  it("times out and falls back to a LiryaError('timeout')", async () => {
    const fetchImpl = vi.fn(async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    });
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPage("pg_1")).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps a 5xx to LiryaError('bad_gateway') with the request id", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(503, { title: "down" }, { "x-request-id": "req-503" }));
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.listPages()).rejects.toMatchObject({ code: "bad_gateway", requestId: "req-503" });
  });

  it("builds the editor URL from the admin base, or null when unset", () => {
    const { client } = makeClient((async () => jsonResponse(200, {})) as unknown as typeof fetch);
    expect(client.editorUrl("recovery")).toBe("https://admin.lirya.test/editor.html?slug=recovery");

    const noAdmin = createLiryaClient({ baseUrl: BASE, apiKey: API_KEY, fetchImpl: (async () => new Response()) as unknown as typeof fetch });
    expect(noAdmin.editorUrl("recovery")).toBeNull();
  });

  it("never puts the API key in a thrown error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { title: "boom" }));
    const { client } = makeClient(fetchImpl as unknown as typeof fetch);
    try {
      await client.listPages();
      throw new Error("expected a rejection");
    } catch (e) {
      expect(e).toBeInstanceOf(LiryaError);
      const err = e as LiryaError;
      expect(JSON.stringify({ m: err.message, p: err.problem })).not.toContain(API_KEY);
    }
  });
});
