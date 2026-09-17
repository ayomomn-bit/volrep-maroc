import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedAndLoginAdmin, asAdmin } from "../test/admin.js";
import { seedSiteMedia } from "../test/seed.js";
import { closeDb, db } from "../db/client.js";
import { homepage } from "../db/schema/index.js";
import { HOMEPAGE_ID } from "../db/schema/homepage.js";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "../lib/homepage/defaults.js";
import { __setMediaStorage } from "../lib/media-storage/index.js";
import { InMemoryMediaStorage } from "../test/media.js";
import { mintHomepagePreviewToken } from "../lib/homepage/preview-token.js";
import { mintPreviewToken } from "../lib/product-page/preview-token.js";

function cloneDefault() {
  return structuredClone(DEFAULT_HOMEPAGE_DOCUMENT) as typeof DEFAULT_HOMEPAGE_DOCUMENT;
}

describe("GET /api/homepage (storefront read)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    __setMediaStorage(new InMemoryMediaStorage());
  });
  afterEach(async () => {
    __setMediaStorage(null);
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("requires the internal API key", async () => {
    const res = await app.inject({ method: "GET", url: "/api/homepage" });
    expect(res.statusCode).toBe(401);
  });

  it("returns the code-owned default when nothing has been published", async () => {
    const res = await app.inject(withAuth({ method: "GET", url: "/api/homepage" }));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.isDefault).toBe(true);
    expect(body.page.sections.map((s: { type: string }) => s.type)).toEqual(
      DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) => s.type),
    );
  });

  it("returns the published document once an admin publishes", async () => {
    const { sessionId } = await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" });
    const doc = cloneDefault();
    doc.sections.find((s) => s.type === "newsletter")!.enabled = false;
    await app.inject(asAdmin(sessionId, { method: "PUT", url: "/api/admin/homepage", payload: { document: doc } }));
    await app.inject(asAdmin(sessionId, { method: "POST", url: "/api/admin/homepage/publish" }));

    const res = await app.inject(withAuth({ method: "GET", url: "/api/homepage" }));
    const body = res.json();
    expect(body.isDefault).toBe(false);
    expect(body.page.sections.find((s: { type: string }) => s.type === "newsletter").enabled).toBe(false);
  });

  it("resolves a kind:image slot to the site_media URL", async () => {
    const media = await seedSiteMedia({ url: "http://media.test/site/abc.png", altText: "seeded alt" });
    const doc = cloneDefault();
    (doc.sections.find((s) => s.type === "recoveryPhilosophy")!.data as { background: unknown }).background = {
      kind: "image",
      imageId: media.id,
      url: "",
      alt: "",
      poster: "",
      placeholderLabel: "",
      mediaType: "image",
      fileName: "",
    };
    await db
      .insert(homepage)
      .values({ id: HOMEPAGE_ID, draft: doc, published: doc, publishedAt: new Date() });

    const res = await app.inject(withAuth({ method: "GET", url: "/api/homepage" }));
    const bg = res
      .json()
      .page.sections.find((s: { type: string }) => s.type === "recoveryPhilosophy").data.background;
    expect(bg.url).toBe("http://media.test/site/abc.png");
    expect(bg.alt).toBe("seeded alt");
  });

  it("downgrades a kind:image slot whose asset was deleted to a placeholder", async () => {
    const doc = cloneDefault();
    (doc.sections.find((s) => s.type === "recoveryPhilosophy")!.data as { background: unknown }).background = {
      kind: "image",
      imageId: "22222222-2222-4222-8222-222222222222",
      url: "",
      alt: "",
      poster: "",
      placeholderLabel: "",
      mediaType: "image",
      fileName: "",
    };
    await db
      .insert(homepage)
      .values({ id: HOMEPAGE_ID, draft: doc, published: doc, publishedAt: new Date() });

    const res = await app.inject(withAuth({ method: "GET", url: "/api/homepage" }));
    const bg = res
      .json()
      .page.sections.find((s: { type: string }) => s.type === "recoveryPhilosophy").data.background;
    expect(bg.kind).toBe("placeholder");
  });

  it("falls back to the default when the stored published document is unparseable", async () => {
    await db.insert(homepage).values({
      id: HOMEPAGE_ID,
      draft: DEFAULT_HOMEPAGE_DOCUMENT,
      published: { version: 1, settings: {}, sections: [{ nope: true }] },
      publishedAt: new Date(),
    });
    const res = await app.inject(withAuth({ method: "GET", url: "/api/homepage" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().page.sections.map((s: { type: string }) => s.type)).toEqual(
      DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) => s.type),
    );
  });

  it("has no write path", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const res = await app.inject(withAuth({ method, url: "/api/homepage" }));
      expect(res.statusCode).toBe(404);
    }
  });

  describe("draft preview", () => {
    async function seedDraftAndPublished() {
      const { sessionId } = await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" });
      const published = cloneDefault();
      published.sections.find((s) => s.type === "hero")!.data.heading = "PUBLISHED heading";
      await app.inject(
        asAdmin(sessionId, { method: "PUT", url: "/api/admin/homepage", payload: { document: published } }),
      );
      await app.inject(asAdmin(sessionId, { method: "POST", url: "/api/admin/homepage/publish" }));

      const draft = cloneDefault();
      draft.sections.find((s) => s.type === "hero")!.data.heading = "DRAFT heading";
      await app.inject(
        asAdmin(sessionId, { method: "PUT", url: "/api/admin/homepage", payload: { document: draft } }),
      );
    }

    it("serves the DRAFT with a valid preview token, PUBLISHED without one", async () => {
      await seedDraftAndPublished();
      const { token } = mintHomepagePreviewToken();

      const preview = await app.inject(
        withAuth({ method: "GET", url: `/api/homepage?preview=${encodeURIComponent(token)}` }),
      );
      expect(preview.statusCode).toBe(200);
      expect(preview.json().preview).toBe(true);
      expect(preview.json().page.sections.find((s: { type: string }) => s.type === "hero").data.heading).toBe(
        "DRAFT heading",
      );

      const noToken = await app.inject(withAuth({ method: "GET", url: "/api/homepage" }));
      expect(noToken.json().preview).toBe(false);
      expect(noToken.json().page.sections.find((s: { type: string }) => s.type === "hero").data.heading).toBe(
        "PUBLISHED heading",
      );
    });

    it("denies a missing token (falls back to published, preview: false)", async () => {
      await seedDraftAndPublished();
      const res = await app.inject(withAuth({ method: "GET", url: "/api/homepage" }));
      expect(res.json().preview).toBe(false);
    });

    it("denies an invalid/forged token", async () => {
      await seedDraftAndPublished();
      const res = await app.inject(
        withAuth({ method: "GET", url: "/api/homepage?preview=forged.not.valid" }),
      );
      expect(res.statusCode).toBe(200);
      expect(res.json().preview).toBe(false);
    });

    it("denies an expired token", async () => {
      await seedDraftAndPublished();
      const now = Date.now();
      const { token } = mintHomepagePreviewToken(now - 31 * 60_000); // minted 31 min ago
      const res = await app.inject(
        withAuth({ method: "GET", url: `/api/homepage?preview=${encodeURIComponent(token)}` }),
      );
      expect(res.json().preview).toBe(false);
    });

    it("denies a product-page token (wrong scope)", async () => {
      await seedDraftAndPublished();
      const { token } = mintPreviewToken("11111111-1111-1111-1111-111111111111");
      const res = await app.inject(
        withAuth({ method: "GET", url: `/api/homepage?preview=${encodeURIComponent(token)}` }),
      );
      expect(res.json().preview).toBe(false);
      expect(res.json().page.sections.find((s: { type: string }) => s.type === "hero").data.heading).toBe(
        "PUBLISHED heading",
      );
    });

    it("still requires the internal API key even with a valid preview token", async () => {
      await seedDraftAndPublished();
      const { token } = mintHomepagePreviewToken();
      const res = await app.inject({ method: "GET", url: `/api/homepage?preview=${encodeURIComponent(token)}` });
      expect(res.statusCode).toBe(401);
    });

    it("a preview response is never cached as public content (no-store / private)", async () => {
      await seedDraftAndPublished();
      const { token } = mintHomepagePreviewToken();
      const res = await app.inject(
        withAuth({ method: "GET", url: `/api/homepage?preview=${encodeURIComponent(token)}` }),
      );
      const cacheControl = res.headers["cache-control"];
      expect(cacheControl == null || !String(cacheControl).includes("public")).toBe(true);
    });
  });
});
