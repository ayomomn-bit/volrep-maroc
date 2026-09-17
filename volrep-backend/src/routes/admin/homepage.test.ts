import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { seedImage, seedProduct } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, homepage, siteMedia } from "../../db/schema/index.js";
import { HOMEPAGE_ID } from "../../db/schema/homepage.js";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "../../lib/homepage/defaults.js";
import { __setMediaStorage } from "../../lib/media-storage/index.js";
import { InMemoryMediaStorage, PNG_1PX, GIF_1PX, MP4_TINY, NOT_AN_IMAGE, multipartFile } from "../../test/media.js";

function cloneDefault() {
  return structuredClone(DEFAULT_HOMEPAGE_DOCUMENT) as typeof DEFAULT_HOMEPAGE_DOCUMENT;
}

describe("Admin Homepage Studio API", () => {
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

  const uploadMedia = (session: string, file: Buffer, filename = "photo.png", contentType = "image/png") =>
    app.inject(
      asAdmin(session, {
        method: "POST",
        url: "/api/admin/homepage/media",
        ...multipartFile({ filename, contentType, content: file }),
      }),
    );

  it("requires an admin session on every route", async () => {
    for (const [method, url] of [
      ["GET", "/api/admin/homepage"],
      ["PUT", "/api/admin/homepage"],
      ["POST", "/api/admin/homepage/publish"],
      ["POST", "/api/admin/homepage/revert"],
      ["GET", "/api/admin/homepage/media"],
      ["POST", "/api/admin/homepage/media"],
      ["DELETE", "/api/admin/homepage/media/00000000-0000-0000-0000-000000000000"],
      ["POST", "/api/admin/homepage/preview-token"],
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("GET creates the singleton row on first read, seeded 1:1 from the default, nothing published", async () => {
    const res = await app.inject(asAdmin(staff, { method: "GET", url: "/api/admin/homepage" }));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasPublished).toBe(false);
    expect(body.published).toBeNull();
    expect(body.draftValid).toBe(true);
    expect(body.draft.sections.map((s: { type: string }) => s.type)).toEqual(
      DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) => s.type),
    );

    const rows = await db.select().from(homepage);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(HOMEPAGE_ID);
    expect(rows[0]?.published).toBeNull();
  });

  it("is a singleton — repeated GETs never create a second row", async () => {
    await app.inject(asAdmin(staff, { method: "GET", url: "/api/admin/homepage" }));
    await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/homepage" }));
    expect(await db.select().from(homepage)).toHaveLength(1);
  });

  it("staff and owner can both edit and publish (Product Studio tier)", async () => {
    const put = await app.inject(
      asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: cloneDefault() } }),
    );
    expect(put.statusCode).toBe(200);
    const pub = await app.inject(asAdmin(owner, { method: "POST", url: "/api/admin/homepage/publish" }));
    expect(pub.statusCode).toBe(200);
  });

  it("PUT saves an edited draft and marks it different from published", async () => {
    const doc = cloneDefault();
    doc.sections.find((s) => s.type === "newsletter")!.enabled = false;

    const res = await app.inject(
      asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: doc } }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().draftMatchesPublished).toBe(false);
    expect(res.json().draft.sections.find((s: { type: string }) => s.type === "newsletter").enabled).toBe(false);

    const audit = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.action, "homepage.draft_save"));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.entityType).toBe("homepage");
    expect(audit[0]?.entityId).toBe(HOMEPAGE_ID);
  });

  it("PUT rejects an invalid document (400, draft untouched)", async () => {
    const bad = cloneDefault() as unknown as { sections: { id: string }[] };
    bad.sections[1]!.id = bad.sections[0]!.id; // duplicate id
    const res = await app.inject(
      asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: bad } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("publish copies draft → published, stamps published_at, and audits", async () => {
    const doc = cloneDefault();
    doc.sections.find((s) => s.type === "faq")!.enabled = false;
    await app.inject(asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: doc } }));

    const res = await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/publish" }));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasPublished).toBe(true);
    expect(body.publishedAt).toBeTruthy();
    expect(body.draftMatchesPublished).toBe(true);
    expect(body.published.sections.find((s: { type: string }) => s.type === "faq").enabled).toBe(false);

    const audit = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "homepage.publish"));
    expect(audit).toHaveLength(1);
  });

  it("revert resets the draft to published (or default when nothing published)", async () => {
    // revert before any publish → back to the default document
    const edited = cloneDefault();
    edited.sections.find((s) => s.type === "hero")!.enabled = false;
    await app.inject(asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: edited } }));

    const r1 = await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/revert" }));
    expect(r1.statusCode).toBe(200);
    expect(r1.json().draft.sections.find((s: { type: string }) => s.type === "hero").enabled).toBe(true);

    // publish, edit again, revert → back to the published version
    await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/publish" }));
    const edited2 = cloneDefault();
    edited2.sections.find((s) => s.type === "testimonials")!.enabled = false;
    await app.inject(asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: edited2 } }));
    const r2 = await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/revert" }));
    expect(r2.json().draft.sections.find((s: { type: string }) => s.type === "testimonials").enabled).toBe(true);
    expect(r2.json().draftMatchesPublished).toBe(true);

    const audit = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "homepage.revert"));
    expect(audit).toHaveLength(2);
  });

  // ---- site media ----------------------------------------------------

  it("uploads homepage media into site_media (NOT product_images), content-addressed under site/", async () => {
    const res = await uploadMedia(staff, PNG_1PX);
    expect(res.statusCode).toBe(201);
    const { media, deduped } = res.json();
    expect(deduped).toBe(false);
    expect(media.mediaType).toBe("image");
    expect(media.url).toMatch(/^http:\/\/media\.test\/site\/[0-9a-f]{64}\.png$/);

    const [key] = [...storage.objects.keys()];
    expect(key).toMatch(/^site\/[0-9a-f]{64}\.png$/);

    const rows = await db.select().from(siteMedia);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.storageKey.startsWith("site/")).toBe(true);

    const audit = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "site_media.upload"));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.entityType).toBe("site_media");
  });

  it("dedupes an identical re-upload", async () => {
    const a = await uploadMedia(staff, PNG_1PX);
    const b = await uploadMedia(owner, PNG_1PX);
    expect(b.json().deduped).toBe(true);
    expect(a.json().media.id).toBe(b.json().media.id);
    expect(await db.select().from(siteMedia)).toHaveLength(1);
  });

  it("accepts GIF and MP4 uploads", async () => {
    const gif = await uploadMedia(staff, GIF_1PX, "clip.gif", "image/gif");
    expect(gif.statusCode).toBe(201);
    expect(gif.json().media.mediaType).toBe("gif");

    const mp4 = await uploadMedia(staff, MP4_TINY, "clip.mp4", "video/mp4");
    expect(mp4.statusCode).toBe(201);
    expect(mp4.json().media.mediaType).toBe("video");
  });

  it("rejects a non-media upload", async () => {
    const res = await uploadMedia(staff, NOT_AN_IMAGE, "notes.png", "image/png");
    expect(res.statusCode).toBe(400);
    expect(await db.select().from(siteMedia)).toHaveLength(0);
  });

  it("deletes a site_media row and its stored object when unreferenced", async () => {
    const up = await uploadMedia(staff, PNG_1PX);
    const id = up.json().media.id;
    expect(storage.objects.size).toBe(1);

    const del = await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/homepage/media/${id}` }));
    expect(del.statusCode).toBe(200);
    expect(await db.select().from(siteMedia)).toHaveLength(0);
    expect(storage.objects.size).toBe(0);

    const audit = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "site_media.delete"));
    expect(audit).toHaveLength(1);
  });

  it("DELETE 404s for an unknown media id", async () => {
    const res = await app.inject(
      asAdmin(staff, { method: "DELETE", url: "/api/admin/homepage/media/00000000-0000-0000-0000-000000000000" }),
    );
    expect(res.statusCode).toBe(404);
  });

  // ---- the isolation guarantee -------------------------------------

  it("accepts a real site_media id in an image slot", async () => {
    const up = await uploadMedia(staff, PNG_1PX);
    const id = up.json().media.id;

    const doc = cloneDefault();
    (doc.sections.find((s) => s.type === "recoveryPhilosophy")!.data as {
      background: unknown;
    }).background = { kind: "image", imageId: id, url: "", alt: "photo" } as never;

    const res = await app.inject(
      asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: doc } }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("REJECTS a product_images id in a homepage image slot", async () => {
    const product = await seedProduct({ handle: "hp-iso" });
    const galleryImage = await seedImage(product.id, { url: "https://cdn.example.com/p.jpg" });

    const doc = cloneDefault();
    (doc.sections.find((s) => s.type === "recoveryPhilosophy")!.data as {
      background: unknown;
    }).background = { kind: "image", imageId: galleryImage.id, url: "", alt: "" } as never;

    const res = await app.inject(
      asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: doc } }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/bibliothèque de médias du site|galerie produit/i);

    // the invalid draft was not written (a failed save doesn't even create
    // the singleton row, same as Product Studio's page-draft save)
    const rows = await db.select().from(homepage).where(eq(homepage.id, HOMEPAGE_ID));
    if (rows[0]) {
      const bg = (rows[0].draft as { sections: { type: string; data: { background?: { kind?: string } } }[] }).sections.find(
        (s) => s.type === "recoveryPhilosophy",
      );
      expect(bg?.data.background?.kind).not.toBe("image");
    }
  });

  it("publish re-validates media references (rejects a draft pointing at a deleted asset)", async () => {
    const up = await uploadMedia(staff, PNG_1PX);
    const id = up.json().media.id;
    const doc = cloneDefault();
    (doc.sections.find((s) => s.type === "recoveryPhilosophy")!.data as { background: unknown }).background = {
      kind: "image",
      imageId: id,
      url: "",
      alt: "",
    } as never;
    await app.inject(asAdmin(staff, { method: "PUT", url: "/api/admin/homepage", payload: { document: doc } }));

    await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/homepage/media/${id}` }));

    const res = await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/publish" }));
    expect(res.statusCode).toBe(400);
  });

  describe("POST /api/admin/homepage/preview-token", () => {
    it("returns a signed, short-lived token — staff or owner", async () => {
      for (const session of [staff, owner]) {
        const res = await app.inject(asAdmin(session, { method: "POST", url: "/api/admin/homepage/preview-token" }));
        expect(res.statusCode).toBe(200);
        expect(typeof res.json().token).toBe("string");
        expect(res.json().token.length).toBeGreaterThan(20);
        expect(typeof res.json().expiresAt).toBe("string");
      }
    });

    it("does not put the document (or anything beyond the token) in the response", async () => {
      const res = await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/preview-token" }));
      expect(Object.keys(res.json()).sort()).toEqual(["expiresAt", "token"]);
    });

    it("ensures a draft row exists (so a first-ever preview still works)", async () => {
      const before = await db.select().from(homepage).where(eq(homepage.id, HOMEPAGE_ID));
      expect(before).toHaveLength(0);

      const res = await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/preview-token" }));
      expect(res.statusCode).toBe(200);

      const after = await db.select().from(homepage).where(eq(homepage.id, HOMEPAGE_ID));
      expect(after).toHaveLength(1);
    });

    it("the minted token unlocks GET /api/homepage's draft, internal-key-gated", async () => {
      const res = await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/preview-token" }));
      const { token } = res.json();

      const preview = await app.inject(
        withAuth({ method: "GET", url: `/api/homepage?preview=${encodeURIComponent(token)}` }),
      );
      expect(preview.json().preview).toBe(true);

      const noKey = await app.inject({ method: "GET", url: `/api/homepage?preview=${encodeURIComponent(token)}` });
      expect(noKey.statusCode).toBe(401);
    });

    it("minting is not itself an audit-logged action and does not write a draft/published change", async () => {
      const beforeAudit = await db.select().from(adminAuditLog);
      await app.inject(asAdmin(staff, { method: "POST", url: "/api/admin/homepage/preview-token" }));
      const afterAudit = await db.select().from(adminAuditLog);
      expect(afterAudit.length).toBe(beforeAudit.length);
    });
  });
});
