import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { seedProduct, seedImage } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { productImages } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { __setMediaStorage } from "../../lib/media-storage/index.js";
import { LocalMediaStorage } from "../../lib/media-storage/local.js";
import { InMemoryMediaStorage, PNG_1PX, JPEG_1PX, NOT_AN_IMAGE, multipartFile } from "../../test/media.js";

describe("Admin product media API (Phase 7C-2)", () => {
  let app: FastifyInstance;
  let owner: string;
  let staff: string;
  let storage: InMemoryMediaStorage;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    storage = new InMemoryMediaStorage();
    __setMediaStorage(storage);
    owner = (await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" })).sessionId;
    staff = (await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" })).sessionId;
  });
  afterEach(async () => {
    __setMediaStorage(null);
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  function upload(session: string, productId: string, file: Buffer, filename = "photo.png", contentType = "image/png") {
    const mp = multipartFile({ filename, contentType, content: file });
    return app.inject(asAdmin(session, { method: "POST", url: `/api/admin/products/${productId}/media`, ...mp }));
  }

  it("uploads an image: stores bytes, persists an owned row, returns a stable URL", async () => {
    const product = await seedProduct({ handle: "media-a" });

    const res = await upload(staff, product.id, PNG_1PX);
    expect(res.statusCode).toBe(201);
    const { image, deduped } = res.json();
    expect(deduped).toBe(false);
    expect(image.owned).toBe(true);
    expect(image.contentType).toBe("image/png");
    expect(image.byteSize).toBe(PNG_1PX.byteLength);
    expect(image.url).toMatch(/^http:\/\/media\.test\/products\/[0-9a-f]{64}\.png$/);
    expect(image.position).toBe(0);

    // bytes really landed in storage, content-addressed
    expect(storage.objects.size).toBe(1);
    const [key] = [...storage.objects.keys()];
    expect(key).toMatch(/^products\/[0-9a-f]{64}\.png$/);

    // db row carries the owned metadata
    const [row] = await db.select().from(productImages).where(eq(productImages.id, image.id));
    expect(row?.storageKey).toBe(key);
    expect(row?.checksum).toHaveLength(64);
  });

  it("is content-addressed: the same bytes twice de-duplicate", async () => {
    const product = await seedProduct({ handle: "media-dedup" });
    const first = await upload(staff, product.id, PNG_1PX);
    const second = await upload(staff, product.id, PNG_1PX);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().deduped).toBe(true);
    expect(second.json().image.id).toBe(first.json().image.id);
    expect(storage.objects.size).toBe(1);
  });

  it("rejects a non-image and a MIME/extension mismatch", async () => {
    const product = await seedProduct({ handle: "media-bad" });

    const notImage = await upload(staff, product.id, NOT_AN_IMAGE, "evil.png", "image/png");
    expect(notImage.statusCode).toBe(400);
    expect(notImage.json().error.message).toMatch(/format/i);

    const mismatch = await upload(staff, product.id, PNG_1PX, "photo.txt", "text/plain");
    expect(mismatch.statusCode).toBe(400);

    expect(storage.objects.size).toBe(0);
  });

  it("rejects an oversized upload (MEDIA_MAX_BYTES)", async () => {
    const product = await seedProduct({ handle: "media-big" });
    // .env.test sets MEDIA_MAX_BYTES=65536
    const big = Buffer.concat([PNG_1PX, Buffer.alloc(70_000, 0)]);
    const res = await upload(staff, product.id, big);
    expect(res.statusCode).toBe(413);
    expect(storage.objects.size).toBe(0);
  });

  it("reorders images and sets a primary", async () => {
    const product = await seedProduct({ handle: "media-order" });
    const a = (await upload(staff, product.id, PNG_1PX)).json().image;
    const b = (await upload(staff, product.id, JPEG_1PX, "photo.jpg", "image/jpeg")).json().image;
    expect([a.position, b.position]).toEqual([0, 1]);

    const reorder = await app.inject(
      asAdmin(staff, { method: "PUT", url: `/api/admin/products/${product.id}/media/order`, payload: { order: [b.id, a.id] } }),
    );
    expect(reorder.statusCode).toBe(200);
    expect(reorder.json().images.map((i: { id: string }) => i.id)).toEqual([b.id, a.id]);

    const primary = await app.inject(
      asAdmin(staff, { method: "PUT", url: `/api/admin/products/${product.id}/media/${a.id}/primary` }),
    );
    expect(primary.json().images[0].id).toBe(a.id);
    expect(primary.json().images[0].position).toBe(0);

    // a bogus order is rejected
    const bad = await app.inject(
      asAdmin(staff, { method: "PUT", url: `/api/admin/products/${product.id}/media/order`, payload: { order: [a.id] } }),
    );
    expect(bad.statusCode).toBe(400);
  });

  it("updates alt text and deletes an image (removing the stored object)", async () => {
    const product = await seedProduct({ handle: "media-del" });
    const img = (await upload(staff, product.id, PNG_1PX)).json().image;
    expect(storage.objects.size).toBe(1);

    const patched = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}/media/${img.id}`, payload: { altText: "Vue de face" } }),
    );
    expect(patched.json().image.altText).toBe("Vue de face");

    const del = await app.inject(
      asAdmin(staff, { method: "DELETE", url: `/api/admin/products/${product.id}/media/${img.id}` }),
    );
    expect(del.statusCode).toBe(200);
    expect(del.json().images).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  });

  it("does NOT delete the stored object while another row still references the same key", async () => {
    const p1 = await seedProduct({ handle: "media-shared-1" });
    const p2 = await seedProduct({ handle: "media-shared-2" });
    const i1 = (await upload(staff, p1.id, PNG_1PX)).json().image;
    const i2 = (await upload(staff, p2.id, PNG_1PX)).json().image; // same bytes → same key
    expect(storage.objects.size).toBe(1);

    await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/products/${p1.id}/media/${i1.id}` }));
    expect(storage.objects.size).toBe(1); // still used by p2

    await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/products/${p2.id}/media/${i2.id}` }));
    expect(storage.objects.size).toBe(0);
  });

  it("keeps a legacy external URL as NOT owned and leaves storage untouched on delete", async () => {
    const product = await seedProduct({ handle: "media-legacy" });
    const legacy = await seedImage(product.id, { url: "https://cdn.shopify.com/s/files/legacy.jpg", position: 0 });

    const detail = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}` }));
    const img = detail.json().product.images.find((i: { id: string }) => i.id === legacy.id);
    expect(img.owned).toBe(false);

    const del = await app.inject(
      asAdmin(staff, { method: "DELETE", url: `/api/admin/products/${product.id}/media/${legacy.id}` }),
    );
    expect(del.statusCode).toBe(200);
    expect(storage.objects.size).toBe(0);
  });

  it("requires an admin session", async () => {
    const product = await seedProduct({ handle: "media-auth" });
    const mp = multipartFile({ filename: "x.png", contentType: "image/png", content: PNG_1PX });
    const res = await app.inject({ method: "POST", url: `/api/admin/products/${product.id}/media`, ...mp });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a forged / unknown session cookie on upload (server-side authz, not UI)", async () => {
    const product = await seedProduct({ handle: "media-forged" });
    const res = await upload("11111111-1111-4111-8111-111111111111", product.id, PNG_1PX);
    expect(res.statusCode).toBe(401);
    expect(storage.objects.size).toBe(0);
  });

  it("rejects HTML renamed to .jpg — the bytes are not an image", async () => {
    const product = await seedProduct({ handle: "media-html" });
    const html = Buffer.from('<!DOCTYPE html><script>alert(document.cookie)</script>'.padEnd(64, " "));
    const res = await upload(staff, product.id, html, "photo.jpg", "image/jpeg");
    expect(res.statusCode).toBe(400);
    expect(storage.objects.size).toBe(0);
  });

  it("rejects an SVG upload (SVG is not an accepted type — active-content XSS risk)", async () => {
    const product = await seedProduct({ handle: "media-svg" });
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>',
    );
    // declared as image/svg+xml → rejected by the MIME/ext pre-filter …
    const asSvg = await upload(staff, product.id, svg, "logo.svg", "image/svg+xml");
    expect(asSvg.statusCode).toBe(400);
    // … and even smuggled under an allowed MIME/ext, the byte sniff rejects it.
    const asPng = await upload(staff, product.id, svg, "logo.png", "image/png");
    expect(asPng.statusCode).toBe(400);
    expect(storage.objects.size).toBe(0);
  });

  it("rejects a decompression-bomb image (small file, header claims 20000×20000)", async () => {
    const product = await seedProduct({ handle: "media-bomb" });
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const be32 = (n: number) => {
      const b = Buffer.alloc(4);
      b.writeUInt32BE(n);
      return b;
    };
    const bomb = Buffer.concat([
      sig,
      be32(13),
      Buffer.from("IHDR"),
      be32(20000),
      be32(20000),
      Buffer.from([8, 6, 0, 0, 0]),
      be32(0),
      Buffer.from("\x00\x00\x00\x00IEND"),
    ]);
    const res = await upload(staff, product.id, bomb, "huge.png", "image/png");
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/trop grande|trop lourde/i);
    expect(storage.objects.size).toBe(0);
    const imgs = await db.select().from(productImages).where(eq(productImages.productId, product.id));
    expect(imgs).toHaveLength(0);
  });

  it("keeps content addressing: same bytes → same key, one byte different → different key", async () => {
    const product = await seedProduct({ handle: "media-ca" });
    const a = await upload(staff, product.id, PNG_1PX, "a.png");
    const b = await upload(staff, product.id, PNG_1PX, "totally-different-name.png");
    expect(b.json().deduped).toBe(true);
    expect(b.json().image.url).toBe(a.json().image.url);

    const tweaked = Buffer.concat([PNG_1PX.subarray(0, PNG_1PX.length - 1), Buffer.from([0x01])]);
    const c = await upload(staff, product.id, tweaked, "a.png");
    // different bytes → not a dupe of a; distinct storage object
    expect(c.json().image.url).not.toBe(a.json().image.url);
    expect(storage.objects.size).toBe(2);
  });

  it("writes an audit row for each media mutation", async () => {
    const product = await seedProduct({ handle: "media-audit" });
    const img = (await upload(owner, product.id, PNG_1PX)).json().image;
    await app.inject(asAdmin(owner, { method: "PUT", url: `/api/admin/products/${product.id}/media/${img.id}/primary` }));

    const log = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/audit-log?entityType=product" }));
    const actions = log.json().entries.map((e: { action: string }) => e.action);
    expect(actions).toContain("product.media_upload");
    expect(actions).toContain("product.media_set_primary");
  });
});

describe("LocalMediaStorage (dev driver)", () => {
  it("writes, reads back, deletes, and refuses path traversal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "volrep-media-"));
    try {
      const s = new LocalMediaStorage({ dir, publicBaseUrl: "http://localhost:4000/" });
      await s.put("products/abc.png", PNG_1PX, "image/png");
      expect(await s.exists("products/abc.png")).toBe(true);
      expect(s.publicUrl("products/abc.png")).toBe("http://localhost:4000/media/products/abc.png");
      await s.delete("products/abc.png");
      expect(await s.exists("products/abc.png")).toBe(false);
      await expect(s.put("../../../etc/evil", PNG_1PX, "image/png")).rejects.toThrow(/escapes/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
