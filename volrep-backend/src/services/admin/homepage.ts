import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { homepage, HOMEPAGE_ID } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "../../lib/homepage/defaults.js";
import {
  parseHomepageDocument,
  siteMediaIdsInDocument,
  type HomepageDocument,
} from "../../lib/homepage/schema.js";
import { mapHomepageAdmin } from "../../mappers/admin.js";
import { assertSiteMediaExists } from "./site-media.js";
import { revalidateStorefrontHomepage } from "../../lib/storefront-revalidate.js";
import { mintHomepagePreviewToken as mintToken } from "../../lib/homepage/preview-token.js";
import type { AdminContext } from "./auth.js";

// ---------------------------------------------------------------------------
// Homepage Studio service — draft / publish / revert for the singleton
// homepage document. Mirrors src/services/admin/product-page.ts.
//
// STEP 1: this backend exists and is fully testable, but the storefront `/`
// does NOT consume it yet — it still renders from its hardcoded components.
// getStorefrontHomepage (src/services/homepage.ts) + GET /api/homepage are
// in place for the future renderer.
// ---------------------------------------------------------------------------

type HomepageRow = typeof homepage.$inferSelect;

// get-or-create the singleton row. On first access the draft is seeded from
// the code-owned default document (a 1:1 copy of today's live homepage) and
// nothing is published — so the Studio always opens on a faithful copy of
// the current page.
async function loadOrCreateRow(): Promise<HomepageRow> {
  const [existing] = await db.select().from(homepage).where(eq(homepage.id, HOMEPAGE_ID)).limit(1);
  if (existing) return existing;

  await db
    .insert(homepage)
    .values({ id: HOMEPAGE_ID, draft: DEFAULT_HOMEPAGE_DOCUMENT })
    .onConflictDoNothing();

  const [row] = await db.select().from(homepage).where(eq(homepage.id, HOMEPAGE_ID)).limit(1);
  if (!row) throw new Error("homepage singleton row missing after create");
  return row;
}

// Every site_media id referenced by a media slot must exist in site_media.
// A product_images id is rejected here for free (it is not in that table) —
// the guarantee that a homepage asset can never be a product gallery image.
async function assertMediaReferences(doc: HomepageDocument): Promise<void> {
  await assertSiteMediaExists(siteMediaIdsInDocument(doc));
}

function describeZod(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues)
  ) {
    return (error as { issues: { path: (string | number)[]; message: string }[] }).issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  }
  return "invalid document";
}

export async function getHomepageForAdmin() {
  return mapHomepageAdmin(await loadOrCreateRow());
}

// Mint a short-lived token the admin UI appends to a storefront preview URL
// to view the UNPUBLISHED draft. The token is scoped to the homepage
// (src/lib/homepage/preview-token.ts) and expires; it grants nothing beyond
// "render the homepage draft" — no write access, no admin session, no
// document content. Mirrors mintProductPagePreviewToken exactly.
export async function mintHomepagePreviewTokenForAdmin() {
  await loadOrCreateRow(); // ensure a draft exists to preview
  return mintToken();
}

export async function saveHomepageDraft(admin: AdminContext, input: unknown) {
  let doc: HomepageDocument;
  try {
    doc = parseHomepageDocument(input);
  } catch (error) {
    throw AppError.badRequest("Le document de la page d’accueil est invalide.", {
      cause: describeZod(error),
    });
  }

  await assertMediaReferences(doc);
  await loadOrCreateRow();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(homepage)
      .set({ draft: doc, updatedAt: new Date(), updatedBy: admin.userId })
      .where(eq(homepage.id, HOMEPAGE_ID))
      .returning();
    if (!row) throw new Error("homepage draft update returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "homepage.draft_save",
      entityType: "homepage",
      entityId: HOMEPAGE_ID,
      metadata: {
        sections: doc.sections.map((s) => ({ id: s.id, type: s.type, enabled: s.enabled })),
      },
    });

    return mapHomepageAdmin(row);
  });
}

export async function publishHomepage(admin: AdminContext) {
  const row = await loadOrCreateRow();

  let doc: HomepageDocument;
  try {
    doc = parseHomepageDocument(row.draft);
  } catch (error) {
    throw AppError.badRequest(
      "Le brouillon ne peut pas être publié : il est invalide. Corrigez-le puis réessayez.",
      { cause: describeZod(error) },
    );
  }
  await assertMediaReferences(doc);

  const result = await db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx
      .update(homepage)
      .set({ published: doc, publishedAt: now, updatedAt: now, updatedBy: admin.userId })
      .where(eq(homepage.id, HOMEPAGE_ID))
      .returning();
    if (!updated) throw new Error("homepage publish returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "homepage.publish",
      entityType: "homepage",
      entityId: HOMEPAGE_ID,
      metadata: {
        sectionCount: doc.sections.length,
        enabledCount: doc.sections.filter((s) => s.enabled).length,
        wasFirstPublish: row.published == null,
      },
    });

    return mapHomepageAdmin(updated);
  });

  // Best-effort, after commit. Harmless today — the storefront `/` does not
  // consume the document yet — but wired so a future publish goes live at once.
  await revalidateStorefrontHomepage();
  return result;
}

// Discard draft edits: reset the draft to whatever is published, or to the
// code-owned default when nothing has been published.
export async function revertHomepageDraft(admin: AdminContext) {
  const row = await loadOrCreateRow();
  const target: HomepageDocument = row.published
    ? parseHomepageDocument(row.published)
    : DEFAULT_HOMEPAGE_DOCUMENT;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(homepage)
      .set({ draft: target, updatedAt: new Date(), updatedBy: admin.userId })
      .where(eq(homepage.id, HOMEPAGE_ID))
      .returning();
    if (!updated) throw new Error("homepage revert returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "homepage.revert",
      entityType: "homepage",
      entityId: HOMEPAGE_ID,
      metadata: { revertedTo: row.published ? "published" : "default" },
    });

    return mapHomepageAdmin(updated);
  });
}
