import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { seedProduct, seedLandingPage } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, productLandingPages } from "../../db/schema/index.js";
import { __setLiryaClientForTests } from "../../lib/lirya/index.js";
import { LiryaError } from "../../lib/lirya/errors.js";
import type { LiryaClient, LiryaPage } from "../../lib/lirya/types.js";

const liryaPage = (over: Partial<LiryaPage> = {}): LiryaPage => ({
  id: "pg_abc",
  type: "landing",
  slug: "recovery",
  name: "Recovery landing",
  status: "published",
  template: "classic",
  url: "https://lirya.test/p/recovery",
  external_ref: null,
  // Real Lirya contract: version is a number, etag is a quoted string.
  version: 1,
  etag: '"pg_abc:1"',
  content_source: "legacy_html",
  created_at: null,
  updated_at: "2026-02-01T00:00:00Z",
  published_at: null,
  ...over,
});

function fakeClient(over: Partial<LiryaClient> = {}): LiryaClient & {
  getPage: ReturnType<typeof vi.fn>;
  listPages: ReturnType<typeof vi.fn>;
} {
  const getPage = vi.fn(async () => ({ status: 200 as const, page: liryaPage() }));
  const listPages = vi.fn(async () => ({ pages: [liryaPage()], nextCursor: null as string | null }));
  return {
    getPage: getPage as never,
    listPages: listPages as never,
    editorUrl: (slug: string) => `https://lirya.test/editor.html?slug=${slug}`,
    ...over,
  } as never;
}

describe("Admin Lirya landing-page integration (V1)", () => {
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
    __setLiryaClientForTests(undefined);
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  // ---- picker ----

  it("GET /api/admin/lirya/pages returns published landing pages and filters by name", async () => {
    const client = fakeClient({
      listPages: vi.fn(async () => ({
        pages: [liryaPage({ id: "pg_1", name: "Recovery" }), liryaPage({ id: "pg_2", name: "Sleep kit" })],
        nextCursor: "cur-2",
      })) as never,
    });
    __setLiryaClientForTests(client);

    const all = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/lirya/pages` }));
    expect(all.statusCode).toBe(200);
    expect(all.json().pages).toHaveLength(2);
    expect(all.json().nextCursor).toBe("cur-2");
    expect(all.json().liryaConfigured).toBe(true);
    // Picker only ever asks Lirya for PUBLISHED LANDING pages (V1).
    expect(client.listPages).toHaveBeenCalledWith(expect.objectContaining({ type: "landing", status: "published" }));
    // Each row carries the fields the association UI shows, incl. updated_at.
    expect(all.json().pages[0]).toMatchObject({
      id: "pg_1",
      name: "Recovery",
      slug: "recovery",
      status: "published",
      template: "classic",
      updatedAt: "2026-02-01T00:00:00Z",
    });

    const filtered = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/lirya/pages?q=sleep` }));
    expect(filtered.json().pages.map((p: { id: string }) => p.id)).toEqual(["pg_2"]);
  });

  it("GET /api/admin/lirya/pages is 503 when Lirya is not configured", async () => {
    __setLiryaClientForTests(null);
    const res = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/lirya/pages` }));
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("LIRYA_NOT_CONFIGURED");
  });

  // ---- associate ----

  it("associates a page, populates the cache, computes derived fields and audits", async () => {
    const product = await seedProduct({ handle: "lp-assoc" });
    __setLiryaClientForTests(
      fakeClient({
        getPage: vi.fn(async () => ({
          status: 200 as const,
          page: liryaPage({ id: "pg_assoc", external_ref: { product_id: product.id }, status: "published" }),
        })) as never,
      }),
    );

    const res = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/landing-pages`,
        payload: { liryaPageId: "pg_assoc" },
      }),
    );
    expect(res.statusCode).toBe(201);
    const lp = res.json().landingPage;
    expect(lp).toMatchObject({
      liryaPageId: "pg_assoc",
      role: "primary",
      cachedStatus: "published",
      name: "Recovery landing",
      verified: true,
      previewUrl: "https://lirya.test/p/recovery",
      editorUrl: "https://lirya.test/editor.html?slug=recovery",
    });

    const [row] = await db.select().from(productLandingPages).where(eq(productLandingPages.productId, product.id));
    expect(row?.cachedEtag).toBe('"pg_abc:1"');
    // Lirya returns version as a number; Volrep normalises it to a string.
    expect(row?.liryaVersion).toBe("1");
    expect(row?.cachedExternalRefProductId).toBe(product.id);

    const audits = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "landing_page.associated"));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.entityType).toBe("landing_page");

    // No payload leaks the transport secret / raw etag under a bearer key.
    expect(JSON.stringify(lp)).not.toContain("Bearer");
    expect(lp).not.toHaveProperty("cachedEtag");
  });

  it("rejects a second primary page for the same product with 409", async () => {
    const product = await seedProduct({ handle: "lp-dupe" });
    await seedLandingPage(product.id, { liryaPageId: "pg_existing", role: "primary" });
    __setLiryaClientForTests(fakeClient());

    const res = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/landing-pages`,
        payload: { liryaPageId: "pg_new" },
      }),
    );
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("LANDING_PAGE_ROLE_TAKEN");
  });

  it("allows several pages per product, one per role, and lists them all", async () => {
    const product = await seedProduct({ handle: "lp-multi" });
    await seedLandingPage(product.id, { liryaPageId: "pg_primary", role: "primary", cachedName: "Principale" });
    __setLiryaClientForTests(
      fakeClient({
        getPage: vi.fn(async () => ({
          status: 200 as const,
          page: liryaPage({ id: "pg_campaign", name: "Campagne été" }),
        })) as never,
      }),
    );

    const add = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/landing-pages`,
        payload: { liryaPageId: "pg_campaign", role: "campaign" },
      }),
    );
    expect(add.statusCode).toBe(201);
    expect(add.json().landingPage).toMatchObject({ liryaPageId: "pg_campaign", role: "campaign" });

    const list = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages?refresh=0` }),
    );
    expect(list.json().landingPages.map((b: { role: string }) => b.role).sort()).toEqual(["campaign", "primary"]);
  });

  it("rejects re-linking the SAME Lirya page to a product (even under a new role)", async () => {
    const product = await seedProduct({ handle: "lp-samepage" });
    await seedLandingPage(product.id, { liryaPageId: "pg_dup", role: "primary" });
    __setLiryaClientForTests(fakeClient());

    const res = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/landing-pages`,
        payload: { liryaPageId: "pg_dup", role: "campaign" },
      }),
    );
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("LANDING_PAGE_ALREADY_LINKED");
  });

  it("returns 404 'Page Lirya introuvable' when Lirya has no such page", async () => {
    const product = await seedProduct({ handle: "lp-missing" });
    __setLiryaClientForTests(
      fakeClient({
        getPage: vi.fn(async () => {
          throw new LiryaError("page_not_found", "no such page", { status: 404 });
        }) as never,
      }),
    );

    const res = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/landing-pages`,
        payload: { liryaPageId: "pg_missing" },
      }),
    );
    expect(res.statusCode).toBe(404);
  });

  it("rejects a malformed liryaPageId before calling Lirya", async () => {
    const product = await seedProduct({ handle: "lp-badid" });
    const client = fakeClient();
    __setLiryaClientForTests(client);

    const res = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/landing-pages`,
        payload: { liryaPageId: "not-a-pg-id" },
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(client.getPage).not.toHaveBeenCalled();
  });

  // ---- integrity check (§8) ----

  it("marks the binding unverified when Lirya's external_ref points elsewhere", async () => {
    const product = await seedProduct({ handle: "lp-integrity" });
    __setLiryaClientForTests(
      fakeClient({
        getPage: vi.fn(async () => ({
          status: 200 as const,
          page: liryaPage({ external_ref: { product_id: "some-other-product" } }),
        })) as never,
      }),
    );

    const res = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/landing-pages`,
        payload: { liryaPageId: "pg_other" },
      }),
    );
    expect(res.json().landingPage.verified).toBe(false);
  });

  // ---- preview rules (§6) ----

  it.each([
    ["hidden", null],
    ["draft", null],
  ])("disables preview for a %s page", async (status, expected) => {
    const product = await seedProduct({ handle: `lp-preview-${status}` });
    await seedLandingPage(product.id, { cachedStatus: status, cachedPublicUrl: "https://lirya.test/x" });
    __setLiryaClientForTests(null);

    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages?refresh=0` }),
    );
    expect(res.json().landingPages[0].previewUrl).toBe(expected);
  });

  it("enables preview for a published page", async () => {
    const product = await seedProduct({ handle: "lp-preview-pub" });
    await seedLandingPage(product.id, { cachedStatus: "published", cachedPublicUrl: "https://lirya.test/pub" });
    __setLiryaClientForTests(null);
    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages?refresh=0` }),
    );
    expect(res.json().landingPages[0].previewUrl).toBe("https://lirya.test/pub");
  });

  // ---- editor link (§7) ----

  it("hides the editor link for an API-created structured draft", async () => {
    const product = await seedProduct({ handle: "lp-structured" });
    await seedLandingPage(product.id, { cachedContentSource: "structured", cachedStatus: "draft" });
    __setLiryaClientForTests(null);
    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages?refresh=0` }),
    );
    expect(res.json().landingPages[0].editorUrl).toBeNull();
  });

  it.each([
    // content_source, status, editor link expected?
    ["legacy_html", "published", true],
    ["legacy_html", "hidden", true],
    ["legacy_html", "draft", false],
    ["structured", "published", false],
    ["wysiwyg", "published", false],
  ])(
    "editor link for content_source=%s status=%s -> %s",
    async (contentSource, status, expected) => {
      const product = await seedProduct({ handle: `lp-editor-${contentSource}-${status}` });
      await seedLandingPage(product.id, {
        cachedContentSource: contentSource,
        cachedStatus: status,
        cachedSlug: "douche",
      });
      __setLiryaClientForTests(null);
      const res = await app.inject(
        asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages?refresh=0` }),
      );
      const editorUrl = res.json().landingPages[0].editorUrl as string | null;
      if (expected) {
        expect(editorUrl).toContain("/editor.html?slug=douche");
        // The Lirya API key is NEVER appended to the outbound editor link.
        expect(editorUrl).not.toMatch(/key|token|bearer/i);
      } else {
        expect(editorUrl).toBeNull();
      }
    },
  );

  // ---- unassociate ----

  it("removes the binding and audits, without ever calling Lirya", async () => {
    const product = await seedProduct({ handle: "lp-remove" });
    const binding = await seedLandingPage(product.id, { liryaPageId: "pg_remove" });
    const client = fakeClient();
    __setLiryaClientForTests(client);

    const res = await app.inject(
      asAdmin(staff, { method: "DELETE", url: `/api/admin/products/${product.id}/landing-pages/${binding.id}` }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().landingPages).toEqual([]);

    const rows = await db.select().from(productLandingPages).where(eq(productLandingPages.id, binding.id));
    expect(rows).toHaveLength(0);
    const audits = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "landing_page.unassociated"));
    expect(audits).toHaveLength(1);
    expect(client.getPage).not.toHaveBeenCalled();
    expect(client.listPages).not.toHaveBeenCalled();
  });

  it("404s when unassociating a binding that belongs to another product", async () => {
    const a = await seedProduct({ handle: "lp-x-a" });
    const b = await seedProduct({ handle: "lp-x-b" });
    const binding = await seedLandingPage(b.id, { liryaPageId: "pg_b" });
    __setLiryaClientForTests(fakeClient());

    const res = await app.inject(
      asAdmin(staff, { method: "DELETE", url: `/api/admin/products/${a.id}/landing-pages/${binding.id}` }),
    );
    expect(res.statusCode).toBe(404);
  });

  // ---- best-effort refresh ----

  it("refresh: a 304 keeps the cache and bumps lastCheckedAt, clearing sync_error", async () => {
    const product = await seedProduct({ handle: "lp-304" });
    await seedLandingPage(product.id, {
      liryaPageId: "pg_304",
      cachedName: "Old name",
      syncError: "unavailable",
      lastCheckedAt: new Date(2000, 0, 1),
    });
    __setLiryaClientForTests(
      fakeClient({ getPage: vi.fn(async () => ({ status: 304 as const })) as never }),
    );

    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages` }),
    );
    expect(res.statusCode).toBe(200);
    const [row] = await db.select().from(productLandingPages).where(eq(productLandingPages.productId, product.id));
    expect(row?.cachedName).toBe("Old name");
    expect(row?.syncError).toBeNull();
    expect(row?.lastCheckedAt?.getFullYear()).toBeGreaterThan(2000);
  });

  it("refresh: a 200 updates the cache", async () => {
    const product = await seedProduct({ handle: "lp-200" });
    await seedLandingPage(product.id, { liryaPageId: "pg_200", cachedName: "Stale", cachedStatus: "draft" });
    __setLiryaClientForTests(
      fakeClient({
        getPage: vi.fn(async () => ({
          status: 200 as const,
          page: liryaPage({ id: "pg_200", name: "Fresh name", status: "published" }),
        })) as never,
      }),
    );

    await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages` }));
    const [row] = await db.select().from(productLandingPages).where(eq(productLandingPages.productId, product.id));
    expect(row?.cachedName).toBe("Fresh name");
    expect(row?.cachedStatus).toBe("published");
  });

  it("refresh: a 404 sets sync_error but keeps the binding", async () => {
    const product = await seedProduct({ handle: "lp-refresh-404" });
    const binding = await seedLandingPage(product.id, { liryaPageId: "pg_gone" });
    __setLiryaClientForTests(
      fakeClient({
        getPage: vi.fn(async () => {
          throw new LiryaError("page_not_found", "gone", { status: 404 });
        }) as never,
      }),
    );

    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages` }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().landingPages[0].syncError).toBe("page_not_found");
    const rows = await db.select().from(productLandingPages).where(eq(productLandingPages.id, binding.id));
    expect(rows).toHaveLength(1);
  });

  it("refresh: a 5xx / timeout falls back to sync_error 'unavailable'", async () => {
    const product = await seedProduct({ handle: "lp-refresh-5xx" });
    await seedLandingPage(product.id, { liryaPageId: "pg_5xx" });
    __setLiryaClientForTests(
      fakeClient({
        getPage: vi.fn(async () => {
          throw new LiryaError("bad_gateway", "down", { status: 503 });
        }) as never,
      }),
    );
    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages` }),
    );
    expect(res.json().landingPages[0].syncError).toBe("unavailable");
  });

  it("refresh=0 does not call Lirya", async () => {
    const product = await seedProduct({ handle: "lp-norefresh" });
    await seedLandingPage(product.id, { liryaPageId: "pg_nr" });
    const client = fakeClient();
    __setLiryaClientForTests(client);

    await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages?refresh=0` }),
    );
    expect(client.getPage).not.toHaveBeenCalled();
  });

  // ---- Product Studio stays cache-only ----

  it("GET /studio returns the cached binding and never calls Lirya", async () => {
    const product = await seedProduct({ handle: "lp-studio" });
    await seedLandingPage(product.id, { liryaPageId: "pg_studio", cachedName: "Studio LP" });
    const client = fakeClient();
    __setLiryaClientForTests(client);

    const res = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/studio` }));
    expect(res.statusCode).toBe(200);
    expect(res.json().landingPages).toHaveLength(1);
    expect(res.json().landingPages[0].name).toBe("Studio LP");
    expect(res.json().completeness.landingPages).toMatchObject({ total: 1, linked: 1 });
    expect(client.getPage).not.toHaveBeenCalled();
    expect(client.listPages).not.toHaveBeenCalled();
  });

  it("requires an admin session", async () => {
    const product = await seedProduct({ handle: "lp-auth" });
    const res = await app.inject({ method: "GET", url: `/api/admin/products/${product.id}/landing-pages` });
    expect(res.statusCode).toBe(401);
  });
});
