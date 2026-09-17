import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { seedImage, seedProduct, seedVariant } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, productImages, productPages } from "../../db/schema/index.js";
import { DEFAULT_PAGE_DOCUMENT } from "../../lib/product-page/defaults.js";
import { __setMediaStorage } from "../../lib/media-storage/index.js";
import { InMemoryMediaStorage, PNG_1PX, JPEG_1PX, MP4_TINY, GIF_1PX, multipartFile } from "../../test/media.js";

function cloneDefault() {
  return structuredClone(DEFAULT_PAGE_DOCUMENT) as typeof DEFAULT_PAGE_DOCUMENT;
}

describe("Admin Product Studio — Page produit API", () => {
  let app: FastifyInstance;
  let owner: string;
  let staff: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    owner = (await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" })).sessionId;
    staff = (await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" })).sessionId;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("requires an admin session", async () => {
    const product = await seedProduct({ handle: "pp-auth" });
    const res = await app.inject({ method: "GET", url: `/api/admin/products/${product.id}/page` });
    expect(res.statusCode).toBe(401);
  });

  it("GET creates the row on first read, seeded 1:1 from the default document, nothing published", async () => {
    const product = await seedProduct({ handle: "pp-first" });

    const res = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/page` }));
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.hasPublished).toBe(false);
    expect(body.published).toBeNull();
    expect(body.draftValid).toBe(true);
    expect(body.draft.sections.map((s: { type: string }) => s.type)).toEqual(
      DEFAULT_PAGE_DOCUMENT.sections.map((s) => s.type),
    );
    expect(body.draft.sections.every((s: { enabled: boolean }) => s.enabled)).toBe(true);

    const rows = await db.select().from(productPages).where(eq(productPages.productId, product.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.published).toBeNull();
  });

  it("GET 404s for an unknown product", async () => {
    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: "/api/admin/products/00000000-0000-0000-0000-000000000000/page" }),
    );
    expect(res.statusCode).toBe(404);
  });

  it("PUT /draft saves an edited document and marks it different from published", async () => {
    const product = await seedProduct({ handle: "pp-draft" });
    const doc = cloneDefault();
    doc.sections[2]!.enabled = false; // hide the descriptionFaq accordion

    const res = await app.inject(
      asAdmin(staff, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/page/draft`,
        payload: { document: doc },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().draftMatchesPublished).toBe(false);
    expect(res.json().draft.sections[2].enabled).toBe(false);

    const [row] = await db.select().from(productPages).where(eq(productPages.productId, product.id));
    expect((row?.draft as typeof doc).sections[2]!.enabled).toBe(false);

    const audit = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.action, "product.page_draft_save"));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.entityId).toBe(product.id);
  });

  it("PUT /draft rejects an invalid document (400, no write)", async () => {
    const product = await seedProduct({ handle: "pp-invalid" });
    const res = await app.inject(
      asAdmin(staff, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/page/draft`,
        payload: { document: { version: 1, settings: {}, sections: [{ id: "x", type: "hero", enabled: true, data: {} }] } },
      }),
    );
    expect(res.statusCode).toBe(400);
    const rows = await db.select().from(productPages).where(eq(productPages.productId, product.id));
    // first read never happened; save failed before get-or-create
    expect(rows).toHaveLength(0);
  });

  it("PUT /draft rejects a media slot pointing at another product's image", async () => {
    const product = await seedProduct({ handle: "pp-media-a" });
    const other = await seedProduct({ handle: "pp-media-b" });
    const foreignImage = await seedImage(other.id, { position: 0 });
    const ownImage = await seedImage(product.id, { position: 0 });

    const withForeign = cloneDefault();
    const heroA = withForeign.sections[0]!;
    if (heroA.type === "hero") {
      heroA.data.beforeAfter.zones[0]!.media = {
        kind: "image",
        imageId: foreignImage.id,
        url: "",
        poster: "",
        alt: "",
        placeholderLabel: "",
        mediaType: "image",
        fileName: "",
      };
    }
    const bad = await app.inject(
      asAdmin(staff, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/page/draft`,
        payload: { document: withForeign },
      }),
    );
    expect(bad.statusCode).toBe(400);

    const withOwn = cloneDefault();
    const heroB = withOwn.sections[0]!;
    if (heroB.type === "hero") {
      heroB.data.beforeAfter.zones[0]!.media = {
        kind: "image",
        imageId: ownImage.id,
        url: "",
        poster: "",
        alt: "",
        placeholderLabel: "",
        mediaType: "image",
        fileName: "",
      };
    }
    const ok = await app.inject(
      asAdmin(staff, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/page/draft`,
        payload: { document: withOwn },
      }),
    );
    expect(ok.statusCode).toBe(200);
  });

  it("POST /publish copies the draft to published and records an audit row", async () => {
    const product = await seedProduct({ handle: "pp-publish" });
    await seedVariant(product.id);

    // edit the draft, then publish
    const doc = cloneDefault();
    doc.sections[12]!.enabled = false; // hide problemSolution
    await app.inject(
      asAdmin(owner, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/page/draft`,
        payload: { document: doc },
      }),
    );

    const res = await app.inject(
      asAdmin(owner, { method: "POST", url: `/api/admin/products/${product.id}/page/publish` }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasPublished).toBe(true);
    expect(body.publishedAt).not.toBeNull();
    expect(body.draftMatchesPublished).toBe(true);
    expect(body.published.sections[12].enabled).toBe(false);

    const audit = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "product.page_publish"));
    expect(audit).toHaveLength(1);

    // editing the draft again makes it diverge from published
    const doc2 = cloneDefault();
    const after = await app.inject(
      asAdmin(owner, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/page/draft`,
        payload: { document: doc2 },
      }),
    );
    expect(after.json().draftMatchesPublished).toBe(false);
  });

  it("POST /revert resets the draft to the published document", async () => {
    const product = await seedProduct({ handle: "pp-revert" });
    await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/page` }));
    await app.inject(asAdmin(staff, { method: "POST", url: `/api/admin/products/${product.id}/page/publish` }));

    const edited = cloneDefault();
    edited.sections[0]!.enabled = false;
    await app.inject(
      asAdmin(staff, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/page/draft`,
        payload: { document: edited },
      }),
    );

    const res = await app.inject(
      asAdmin(staff, { method: "POST", url: `/api/admin/products/${product.id}/page/revert` }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().draft.sections[0].enabled).toBe(true);
    expect(res.json().draftMatchesPublished).toBe(true);
  });

  it("POST /preview-token returns a token bound to the product + its handle", async () => {
    const product = await seedProduct({ handle: "pp-token" });
    const res = await app.inject(
      asAdmin(staff, { method: "POST", url: `/api/admin/products/${product.id}/page/preview-token` }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().handle).toBe("pp-token");
    expect(typeof res.json().token).toBe("string");
    expect(res.json().token.length).toBeGreaterThan(20);
  });

  it("does not touch cart / checkout / product-detail contracts", async () => {
    const product = await seedProduct({ handle: "pp-scope" });
    await seedVariant(product.id);
    await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/page` }));
    await app.inject(asAdmin(staff, { method: "POST", url: `/api/admin/products/${product.id}/page/publish` }));

    // the admin product-detail contract is unchanged
    const detail = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}` }));
    expect(detail.statusCode).toBe(200);
    expect(detail.json().product).not.toHaveProperty("page");

    // the studio aggregate is unchanged
    const studio = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/studio` }));
    expect(Object.keys(studio.json().completeness).sort()).toEqual(["commerce", "landingPages", "media"]);
  });

  // ---- section media upload (POST .../page/media) ----
  // A landing-page section asset must NOT become a product-gallery image.

  describe("page media upload", () => {
    let storage: InMemoryMediaStorage;
    beforeEach(() => {
      storage = new InMemoryMediaStorage();
      __setMediaStorage(storage);
    });
    afterEach(() => __setMediaStorage(null));

    function upload(session: string, productId: string, bytes: Buffer, filename = "shot.png", contentType = "image/png") {
      const mp = multipartFile({ filename, contentType, content: bytes });
      return app.inject(asAdmin(session, { method: "POST", url: `/api/admin/products/${productId}/page/media`, ...mp }));
    }

    it("stores the image and returns a URL WITHOUT creating a product_images row", async () => {
      const product = await seedProduct({ handle: "pm-basic" });

      const res = await upload(staff, product.id, PNG_1PX);
      expect(res.statusCode).toBe(201);
      expect(typeof res.json().url).toBe("string");
      expect(res.json().url).toMatch(/^https?:\/\//);

      // the gallery is untouched
      const imgs = await db.select().from(productImages).where(eq(productImages.productId, product.id));
      expect(imgs).toHaveLength(0);

      // audited as a page-media upload, not a gallery upload
      const [audit] = await db
        .select()
        .from(adminAuditLog)
        .where(eq(adminAuditLog.action, "product.page_media_upload"));
      expect(audit?.entityType).toBe("product");
      expect(audit?.entityId).toBe(product.id);
    });

    it("reuses the same physical object for the same bytes — no duplicate, still no product_images row", async () => {
      const product = await seedProduct({ handle: "pm-dedupe" });

      const a = await upload(staff, product.id, PNG_1PX);
      const b = await upload(staff, product.id, PNG_1PX, "again.png");
      expect(a.json().url).toBe(b.json().url); // content-addressed key
      expect(storage.objects.size).toBe(1);

      const imgs = await db.select().from(productImages).where(eq(productImages.productId, product.id));
      expect(imgs).toHaveLength(0);
    });

    it("a page-media file and a gallery upload of the same bytes share one object; the gallery still gets exactly one image", async () => {
      const product = await seedProduct({ handle: "pm-shared" });

      const page = await upload(staff, product.id, JPEG_1PX, "s.jpg", "image/jpeg");
      const gallery = await app.inject(
        asAdmin(staff, {
          method: "POST",
          url: `/api/admin/products/${product.id}/media`,
          ...multipartFile({ filename: "s.jpg", contentType: "image/jpeg", content: JPEG_1PX }),
        }),
      );
      expect(gallery.statusCode).toBe(201);
      expect(gallery.json().image.url).toBe(page.json().url); // same storage key
      expect(storage.objects.size).toBe(1); // one physical file

      const imgs = await db.select().from(productImages).where(eq(productImages.productId, product.id));
      expect(imgs).toHaveLength(1); // gallery has ONLY the explicitly-added one
    });

    it("rejects a non-image and an oversized file", async () => {
      const product = await seedProduct({ handle: "pm-reject" });
      const notImage = await upload(staff, product.id, Buffer.from("hello world not an image"), "x.png");
      expect(notImage.statusCode).toBe(400);
    });

    it("rejects an oversized GIF (MEDIA_GIF_MAX_BYTES) and an oversized MP4 (MEDIA_VIDEO_MAX_BYTES)", async () => {
      const product = await seedProduct({ handle: "pm-oversize" });
      // .env.test: GIF cap 98304, video cap 131072
      const bigGif = Buffer.concat([GIF_1PX, Buffer.alloc(100_000, 0x21)]);
      const gifRes = await upload(staff, product.id, bigGif, "big.gif", "image/gif");
      expect(gifRes.statusCode).toBe(413);

      const bigMp4 = Buffer.concat([MP4_TINY, Buffer.alloc(140_000, 0)]);
      const mp4Res = await upload(staff, product.id, bigMp4, "big.mp4", "video/mp4");
      expect(mp4Res.statusCode).toBe(413);

      expect(storage.objects.size).toBe(0);
    });

    it("rejects a decompression-bomb image for a section slot (header claims 30000×30000)", async () => {
      const product = await seedProduct({ handle: "pm-bomb" });
      const be32 = (n: number) => {
        const b = Buffer.alloc(4);
        b.writeUInt32BE(n);
        return b;
      };
      const bomb = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        be32(13),
        Buffer.from("IHDR"),
        be32(30000),
        be32(30000),
        Buffer.from([8, 6, 0, 0, 0, 0, 0, 0, 0]),
      ]);
      const res = await upload(staff, product.id, bomb, "bomb.png", "image/png");
      expect(res.statusCode).toBe(400);
      expect(storage.objects.size).toBe(0);
    });

    it("a section-media upload NEVER creates a product_images row (gallery separation)", async () => {
      const product = await seedProduct({ handle: "pm-separation" });
      await upload(staff, product.id, PNG_1PX, "a.png");
      await upload(staff, product.id, GIF_1PX, "b.gif", "image/gif");
      await upload(staff, product.id, MP4_TINY, "c.mp4", "video/mp4");
      const imgs = await db.select().from(productImages).where(eq(productImages.productId, product.id));
      expect(imgs).toHaveLength(0);
    });

    it("accepts an MP4 for a UGC slot and returns mediaType:video WITHOUT a product_images row", async () => {
      const product = await seedProduct({ handle: "pm-video" });

      const res = await upload(staff, product.id, MP4_TINY, "ugc_01.mp4", "video/mp4");
      expect(res.statusCode).toBe(201);
      expect(res.json().mediaType).toBe("video");
      expect(res.json().contentType).toBe("video/mp4");
      expect(res.json().url).toMatch(/\.mp4$/);

      const imgs = await db.select().from(productImages).where(eq(productImages.productId, product.id));
      expect(imgs).toHaveLength(0);
    });

    it("reuses one physical object when the same MP4 is uploaded again (no duplicate)", async () => {
      const product = await seedProduct({ handle: "pm-video-dedupe" });
      const a = await upload(staff, product.id, MP4_TINY, "a.mp4", "video/mp4");
      const b = await upload(staff, product.id, MP4_TINY, "b.mp4", "video/mp4");
      expect(a.json().url).toBe(b.json().url);
      expect(storage.objects.size).toBe(1);
    });

    it("rejects a file whose bytes are not a real MP4 even if named .mp4", async () => {
      const product = await seedProduct({ handle: "pm-video-fake" });
      const res = await upload(staff, product.id, Buffer.from("not really an mp4 at all"), "fake.mp4", "video/mp4");
      expect(res.statusCode).toBe(400);
    });

    it("accepts an animated GIF and returns mediaType:gif + image/gif WITHOUT a product_images row", async () => {
      const product = await seedProduct({ handle: "pm-gif" });

      const res = await upload(staff, product.id, GIF_1PX, "ugc_01.gif", "image/gif");
      expect(res.statusCode).toBe(201);
      expect(res.json().mediaType).toBe("gif");
      expect(res.json().contentType).toBe("image/gif");
      expect(res.json().url).toMatch(/\.gif$/);

      const imgs = await db.select().from(productImages).where(eq(productImages.productId, product.id));
      expect(imgs).toHaveLength(0);
    });

    it("reuses one physical object when the same GIF is uploaded again (no duplicate)", async () => {
      const product = await seedProduct({ handle: "pm-gif-dedupe" });
      const a = await upload(staff, product.id, GIF_1PX, "a.gif", "image/gif");
      const b = await upload(staff, product.id, GIF_1PX, "b.gif", "image/gif");
      expect(a.json().url).toBe(b.json().url);
      expect(storage.objects.size).toBe(1);
    });

    it("rejects a file whose bytes are not a real GIF even if named .gif", async () => {
      const product = await seedProduct({ handle: "pm-gif-fake" });
      const res = await upload(staff, product.id, PNG_1PX, "fake.gif", "image/gif");
      expect(res.statusCode).toBe(400);
    });
  });
});
