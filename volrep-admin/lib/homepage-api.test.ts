import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the one API client so we can assert exactly which endpoint each
// Homepage Studio call hits — and prove none of them ever touch a product
// media endpoint.
const { get, post, put, del, upload } = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({}),
  post: vi.fn().mockResolvedValue({}),
  put: vi.fn().mockResolvedValue({}),
  del: vi.fn().mockResolvedValue({}),
  upload: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/api", () => ({
  api: { get, post, put, del, upload },
  ApiError: class ApiError extends Error {},
}));

import { HOMEPAGE_MEDIA_PATH, HOMEPAGE_PATH, homepageApi } from "@/lib/homepage-api";
import type { HomepageSection } from "@/lib/types";

const SECTIONS: HomepageSection[] = [
  {
    id: "bestSellers",
    type: "bestSellers",
    enabled: true,
    data: { eyebrow: "Boutique", heading: "Meilleures ventes", body: "x", source: { mode: "catalog", limit: 8 } },
  },
];

describe("homepageApi — endpoint contract", () => {
  beforeEach(() => {
    get.mockClear();
    post.mockClear();
    put.mockClear();
    del.mockClear();
    upload.mockClear();
  });

  it("paths are all under /api/admin/homepage", () => {
    expect(HOMEPAGE_PATH).toBe("/api/admin/homepage");
    expect(HOMEPAGE_MEDIA_PATH).toBe("/api/admin/homepage/media");
  });

  it("get() → GET /api/admin/homepage", async () => {
    await homepageApi.get();
    expect(get).toHaveBeenCalledWith("/api/admin/homepage");
  });

  it("saveDraft() → PUT /api/admin/homepage with the version-1 document envelope", async () => {
    await homepageApi.saveDraft(SECTIONS);
    expect(put).toHaveBeenCalledTimes(1);
    const [path, body] = put.mock.calls[0]!;
    expect(path).toBe("/api/admin/homepage");
    expect(body).toEqual({ document: { version: 1, settings: {}, sections: SECTIONS } });
  });

  it("publish() → POST /api/admin/homepage/publish", async () => {
    await homepageApi.publish();
    expect(post).toHaveBeenCalledWith("/api/admin/homepage/publish");
  });

  it("revert() → POST /api/admin/homepage/revert", async () => {
    await homepageApi.revert();
    expect(post).toHaveBeenCalledWith("/api/admin/homepage/revert");
  });

  it("previewToken() → POST /api/admin/homepage/preview-token", async () => {
    await homepageApi.previewToken();
    expect(post).toHaveBeenCalledWith("/api/admin/homepage/preview-token");
  });

  it("listMedia() → GET /api/admin/homepage/media (site_media, not product_images)", async () => {
    await homepageApi.listMedia();
    expect(get).toHaveBeenCalledWith("/api/admin/homepage/media");
  });

  it("uploadMedia() → POST /api/admin/homepage/media with a multipart 'file' field", async () => {
    const file = new File(["bytes"], "hero.png", { type: "image/png" });
    await homepageApi.uploadMedia(file);
    expect(upload).toHaveBeenCalledTimes(1);
    const [path, form] = upload.mock.calls[0]!;
    expect(path).toBe("/api/admin/homepage/media");
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get("file")).toBe(file);
  });

  it("deleteMedia() → DELETE /api/admin/homepage/media/:id", async () => {
    await homepageApi.deleteMedia("abc-123");
    expect(del).toHaveBeenCalledWith("/api/admin/homepage/media/abc-123");
  });

  it("NEVER calls a product media endpoint", async () => {
    await homepageApi.get();
    await homepageApi.saveDraft(SECTIONS);
    await homepageApi.publish();
    await homepageApi.revert();
    await homepageApi.previewToken();
    await homepageApi.listMedia();
    await homepageApi.uploadMedia(new File(["x"], "x.png", { type: "image/png" }));
    await homepageApi.deleteMedia("id");

    const everyPath = [
      ...get.mock.calls,
      ...post.mock.calls,
      ...put.mock.calls,
      ...del.mock.calls,
      ...upload.mock.calls,
    ].map((call) => String(call[0]));

    for (const path of everyPath) {
      expect(path.startsWith("/api/admin/homepage")).toBe(true);
      expect(path).not.toContain("/products/");
      expect(path).not.toContain("product_images");
    }
  });
});
