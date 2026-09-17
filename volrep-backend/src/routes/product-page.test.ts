import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedImage, seedProduct, seedProductPage, seedVariant } from "../test/seed.js";
import { closeDb, db } from "../db/client.js";
import { productPages } from "../db/schema/index.js";
import { DEFAULT_PAGE_DOCUMENT } from "../lib/product-page/defaults.js";
import { mintPreviewToken } from "../lib/product-page/preview-token.js";

describe("Storefront product page document API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("requires the internal API key", async () => {
    const res = await app.inject({ method: "GET", url: "/api/products/whatever/page" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an admin cookie (this is an internal-key boundary)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/products/whatever/page",
      cookies: { volrep_admin_session: "nope" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("404s for an unknown or non-active product", async () => {
    await seedProduct({ handle: "pp-draft-status", status: "draft" });
    const unknown = await app.inject(withAuth({ method: "GET", url: "/api/products/nope/page" }));
    expect(unknown.statusCode).toBe(404);
    const draft = await app.inject(withAuth({ method: "GET", url: "/api/products/pp-draft-status/page" }));
    expect(draft.statusCode).toBe(404);
  });

  it("returns the code-owned default document when nothing has been published", async () => {
    await seedProduct({ handle: "pp-nopub", status: "active" });
    const res = await app.inject(withAuth({ method: "GET", url: "/api/products/pp-nopub/page" }));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.preview).toBe(false);
    expect(body.isDefault).toBe(true);
    expect(body.page.sections.map((s: { type: string }) => s.type)).toEqual(
      DEFAULT_PAGE_DOCUMENT.sections.map((s) => s.type),
    );
  });

  it("returns the published document once one exists", async () => {
    const product = await seedProduct({ handle: "pp-pub", status: "active" });
    const published = structuredClone(DEFAULT_PAGE_DOCUMENT) as typeof DEFAULT_PAGE_DOCUMENT;
    published.sections[1]!.enabled = false; // ugc hidden in the published version
    await seedProductPage(product.id, { published, draft: DEFAULT_PAGE_DOCUMENT });

    const res = await app.inject(withAuth({ method: "GET", url: "/api/products/pp-pub/page" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().isDefault).toBe(false);
    expect(res.json().preview).toBe(false);
    expect(res.json().page.sections[1].enabled).toBe(false);
  });

  it("serves the DRAFT with a valid preview token, published without one", async () => {
    const product = await seedProduct({ handle: "pp-preview", status: "active" });
    const draft = structuredClone(DEFAULT_PAGE_DOCUMENT) as typeof DEFAULT_PAGE_DOCUMENT;
    draft.sections[0]!.enabled = false; // draft-only change
    await seedProductPage(product.id, { draft, published: DEFAULT_PAGE_DOCUMENT });

    const { token } = mintPreviewToken(product.id);
    const preview = await app.inject(
      withAuth({ method: "GET", url: `/api/products/pp-preview/page?preview=${encodeURIComponent(token)}` }),
    );
    expect(preview.statusCode).toBe(200);
    expect(preview.json().preview).toBe(true);
    expect(preview.json().page.sections[0].enabled).toBe(false);

    const noToken = await app.inject(withAuth({ method: "GET", url: "/api/products/pp-preview/page" }));
    expect(noToken.json().preview).toBe(false);
    expect(noToken.json().page.sections[0].enabled).toBe(true);

    const badToken = await app.inject(
      withAuth({ method: "GET", url: "/api/products/pp-preview/page?preview=forged" }),
    );
    expect(badToken.json().preview).toBe(false);
  });

  it("a preview token for another product does not unlock this draft", async () => {
    const a = await seedProduct({ handle: "pp-a", status: "active" });
    const b = await seedProduct({ handle: "pp-b", status: "active" });
    const draftA = structuredClone(DEFAULT_PAGE_DOCUMENT) as typeof DEFAULT_PAGE_DOCUMENT;
    draftA.sections[0]!.enabled = false;
    await seedProductPage(a.id, { draft: draftA, published: DEFAULT_PAGE_DOCUMENT });

    const { token: tokenForB } = mintPreviewToken(b.id);
    const res = await app.inject(
      withAuth({ method: "GET", url: `/api/products/pp-a/page?preview=${encodeURIComponent(tokenForB)}` }),
    );
    expect(res.json().preview).toBe(false);
    expect(res.json().page.sections[0].enabled).toBe(true);
  });

  it("is read-only — never creates a product_pages row", async () => {
    await seedProduct({ handle: "pp-readonly", status: "active" });
    await app.inject(withAuth({ method: "GET", url: "/api/products/pp-readonly/page" }));
    const rows = await db.select().from(productPages);
    expect(rows).toHaveLength(0);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const res = await app.inject(withAuth({ method, url: "/api/products/pp-readonly/page" }));
      expect(res.statusCode).toBe(404);
    }
  });

  it("resolves an image-slot to the product image URL (and downgrades a stale one)", async () => {
    const product = await seedProduct({ handle: "pp-imgslot", status: "active" });
    const image = await seedImage(product.id, { url: "http://localhost:4000/media/products/abc.png", position: 0 });

    const doc = structuredClone(DEFAULT_PAGE_DOCUMENT) as typeof DEFAULT_PAGE_DOCUMENT;
    const hero = doc.sections[0]!;
    if (hero.type === "hero") {
      hero.data.beforeAfter.zones[0]!.media = {
        kind: "image",
        imageId: image.id,
        url: "",
        poster: "",
        alt: "",
        placeholderLabel: "x",
        mediaType: "image",
        fileName: "",
      };
      hero.data.beforeAfter.zones[1]!.media = {
        kind: "image",
        imageId: "00000000-0000-0000-0000-000000000000",
        url: "",
        poster: "",
        alt: "",
        placeholderLabel: "y",
        mediaType: "image",
        fileName: "",
      };
    }
    await seedProductPage(product.id, { published: doc, draft: doc });

    const res = await app.inject(withAuth({ method: "GET", url: "/api/products/pp-imgslot/page" }));
    const section = res.json().page.sections[0];
    expect(section.data.beforeAfter.zones[0].media).toMatchObject({
      kind: "image",
      url: "http://localhost:4000/media/products/abc.png",
    });
    // stale reference -> placeholder
    expect(section.data.beforeAfter.zones[1].media.kind).toBe("placeholder");
    expect(section.data.beforeAfter.zones[1].media.imageId).toBeNull();
  });

  it("resolves a comparison-section image slot (and parses a legacy doc with no comparison media key)", async () => {
    const product = await seedProduct({ handle: "pp-cmpslot", status: "active" });
    const image = await seedImage(product.id, { url: "http://localhost:4000/media/products/cmp.png", position: 0 });

    const doc = structuredClone(DEFAULT_PAGE_DOCUMENT) as typeof DEFAULT_PAGE_DOCUMENT;
    const cmpIndex = doc.sections.findIndex((s) => s.type === "comparison");
    const cmp = doc.sections[cmpIndex]!;
    if (cmp.type === "comparison") {
      cmp.data.media = {
        kind: "image",
        imageId: image.id,
        url: "",
        poster: "",
        alt: "",
        placeholderLabel: "",
        mediaType: "image",
        fileName: "",
      };
    }
    // A document shape from before the comparison media field existed.
    const legacy = structuredClone(DEFAULT_PAGE_DOCUMENT) as typeof DEFAULT_PAGE_DOCUMENT;
    const legacyCmp = legacy.sections[cmpIndex]! as { data: Record<string, unknown> };
    delete legacyCmp.data.media;

    await seedProductPage(product.id, { published: doc, draft: legacy });

    const res = await app.inject(withAuth({ method: "GET", url: "/api/products/pp-cmpslot/page" }));
    expect(res.statusCode).toBe(200);
    const section = res.json().page.sections[cmpIndex];
    expect(section.data.media).toMatchObject({
      kind: "image",
      url: "http://localhost:4000/media/products/cmp.png",
    });
  });

  it("falls back to the default document if the stored published doc is corrupt", async () => {
    const product = await seedProduct({ handle: "pp-corrupt", status: "active" });
    await seedProductPage(product.id, { draft: DEFAULT_PAGE_DOCUMENT });
    // hand-corrupt the published column
    await db
      .update(productPages)
      .set({ published: { version: 1, settings: {}, sections: [{ id: "x", type: "hero", enabled: true, data: {} }] } })
      .where(eq(productPages.productId, product.id));

    const res = await app.inject(withAuth({ method: "GET", url: "/api/products/pp-corrupt/page" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().page.sections).toHaveLength(DEFAULT_PAGE_DOCUMENT.sections.length);
  });
});
