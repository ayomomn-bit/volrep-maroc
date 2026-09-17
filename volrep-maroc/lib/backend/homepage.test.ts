import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Server-only guard: stub it out so this runs in plain vitest (node), same
// pattern as lib/backend/product-page.ts's own consumers.
vi.mock("server-only", () => ({}));

import { getStorefrontHomepage, HOMEPAGE_TAG } from "./homepage";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "@/lib/homepage/default-document";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("getStorefrontHomepage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("prefers the published document when the backend returns one (isDefault: false)", async () => {
    const published = {
      ...DEFAULT_HOMEPAGE_DOCUMENT,
      sections: DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) =>
        s.type === "hero" ? { ...s, data: { ...s.data, heading: "A published heading" } } : s,
      ),
    };
    fetchMock.mockResolvedValue(jsonResponse({ page: published, isDefault: false }));

    const result = await getStorefrontHomepage();

    expect(result.isDefault).toBe(false);
    const hero = result.page.sections.find((s) => s.type === "hero");
    expect(hero?.type === "hero" && hero.data.heading).toBe("A published heading");
  });

  it("uses the backend-provided default when nothing has been published (isDefault: true)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ page: DEFAULT_HOMEPAGE_DOCUMENT, isDefault: true }));

    const result = await getStorefrontHomepage();

    expect(result.isDefault).toBe(true);
    expect(result.page).toEqual(DEFAULT_HOMEPAGE_DOCUMENT);
  });

  it("falls back to the code-owned default document when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await getStorefrontHomepage();

    expect(result.isDefault).toBe(true);
    expect(result.page).toEqual(DEFAULT_HOMEPAGE_DOCUMENT);
  });

  it("falls back to the code-owned default document on a non-2xx backend response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "SERVER_ERROR", message: "boom" } }, 500));

    const result = await getStorefrontHomepage();

    expect(result.isDefault).toBe(true);
    expect(result.page).toEqual(DEFAULT_HOMEPAGE_DOCUMENT);
  });

  it("falls back to the code-owned default document when the response shape is unrecognised", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ page: { not: "a homepage document" } }));

    const result = await getStorefrontHomepage();

    expect(result.isDefault).toBe(true);
    expect(result.page).toEqual(DEFAULT_HOMEPAGE_DOCUMENT);
  });

  it("never requests a draft/preview — only the published storefront endpoint", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ page: DEFAULT_HOMEPAGE_DOCUMENT, isDefault: true }));

    await getStorefrontHomepage();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/homepage");
    expect(url).not.toMatch(/draft|preview/i);
  });

  it("tags the fetch with the homepage cache tag used by the revalidate route", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ page: DEFAULT_HOMEPAGE_DOCUMENT, isDefault: true }));

    await getStorefrontHomepage();

    const init = fetchMock.mock.calls[0]?.[1] as { next?: { tags?: string[] } };
    expect(init.next?.tags).toContain(HOMEPAGE_TAG);
    expect(HOMEPAGE_TAG).toBe("homepage");
  });

  describe("preview", () => {
    it("forwards the preview token as a query param and reports preview: true when the backend confirms it", async () => {
      const draft = {
        ...DEFAULT_HOMEPAGE_DOCUMENT,
        sections: DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) =>
          s.type === "hero" ? { ...s, data: { ...s.data, heading: "DRAFT heading" } } : s,
        ),
      };
      fetchMock.mockResolvedValue(jsonResponse({ page: draft, preview: true, isDefault: false }));

      const result = await getStorefrontHomepage({ previewToken: "sometoken" });

      expect(result.preview).toBe(true);
      const hero = result.page.sections.find((s) => s.type === "hero");
      expect(hero?.type === "hero" && hero.data.heading).toBe("DRAFT heading");

      const url = String(fetchMock.mock.calls[0]?.[0]);
      expect(url).toContain("preview=sometoken");
    });

    it("never caches a preview request (revalidate: 0, no tags)", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ page: DEFAULT_HOMEPAGE_DOCUMENT, preview: true, isDefault: false }));

      await getStorefrontHomepage({ previewToken: "sometoken" });

      const init = fetchMock.mock.calls[0]?.[1] as { next?: { revalidate?: number; tags?: string[] } };
      expect(init.next?.revalidate).toBe(0);
      expect(init.next?.tags).toBeUndefined();
    });

    it("reports preview: false and does not send a preview query param when no token is given", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ page: DEFAULT_HOMEPAGE_DOCUMENT, preview: false, isDefault: true }));

      const result = await getStorefrontHomepage();

      expect(result.preview).toBe(false);
      const url = String(fetchMock.mock.calls[0]?.[0]);
      expect(url).not.toContain("preview=");
    });

    it("falls back to the code-owned default document when a preview request fails", async () => {
      fetchMock.mockRejectedValue(new Error("network down"));

      const result = await getStorefrontHomepage({ previewToken: "sometoken" });

      expect(result.preview).toBe(false);
      expect(result.isDefault).toBe(true);
      expect(result.page).toEqual(DEFAULT_HOMEPAGE_DOCUMENT);
    });

    it("reports preview: false when the backend rejects an invalid/expired token (serves published instead)", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ page: DEFAULT_HOMEPAGE_DOCUMENT, preview: false, isDefault: true }));

      const result = await getStorefrontHomepage({ previewToken: "expired-or-forged" });

      expect(result.preview).toBe(false);
    });
  });
});
