import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { productImages, productPages, products } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { DEFAULT_PAGE_DOCUMENT } from "../../lib/product-page/defaults.js";
import {
  imageIdsInDocument,
  mapDocumentMediaSlots,
  parsePageDocument,
  type MediaSlot,
  type PageDocument,
} from "../../lib/product-page/schema.js";
import { mapProductPageAdmin } from "../../mappers/admin.js";
import { mintPreviewToken } from "../../lib/product-page/preview-token.js";
import { revalidateStorefrontProductPage } from "../../lib/storefront-revalidate.js";
import { putImageObject, putVideoObject, putGifObject } from "./media.js";
import type { AdminContext } from "./auth.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type PageRow = typeof productPages.$inferSelect;

async function loadProductOr404(productId: string): Promise<{ id: string; handle: string }> {
  const [row] = await db
    .select({ id: products.id, handle: products.handle })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) throw AppError.notFound("Product not found");
  return row;
}

// get-or-create the product_pages row. On first access the draft is seeded
// from the code-owned default document (today's live page) and nothing is
// published yet — so the Studio always opens on a faithful copy of the
// current page rather than an empty editor.
async function loadOrCreateRow(productId: string): Promise<PageRow> {
  const [existing] = await db.select().from(productPages).where(eq(productPages.productId, productId)).limit(1);
  if (existing) return existing;

  await db
    .insert(productPages)
    .values({ productId, draft: DEFAULT_PAGE_DOCUMENT })
    .onConflictDoNothing();

  const [row] = await db.select().from(productPages).where(eq(productPages.productId, productId)).limit(1);
  if (!row) throw new Error("product_pages row missing after create");
  return row;
}

// Every product-image id referenced by a media slot must belong to THIS
// product. External-URL and placeholder slots are unrestricted.
async function assertImagesBelong(productId: string, doc: PageDocument): Promise<void> {
  const ids = imageIdsInDocument(doc);
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: productImages.id })
    .from(productImages)
    .where(and(eq(productImages.productId, productId), inArray(productImages.id, ids)));
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw AppError.badRequest("Une image sélectionnée n’appartient pas à ce produit.", { missing });
  }
}

export async function getProductPageForAdmin(productId: string) {
  await loadProductOr404(productId);
  return mapProductPageAdmin(await loadOrCreateRow(productId));
}

export async function mintProductPagePreviewToken(productId: string) {
  const product = await loadProductOr404(productId);
  await loadOrCreateRow(productId); // ensure a draft exists to preview
  const minted = mintPreviewToken(productId);
  return { ...minted, handle: product.handle };
}

// Upload an image, an animated GIF, OR an MP4 video FOR USE IN A "PAGE
// PRODUIT" MEDIA SLOT. It is stored on media storage and returned as a URL
// the section's slot references (kind:"url"). It is deliberately NOT
// written to product_images — a landing-page section asset is not a
// product-gallery image and must never appear in the storefront hero
// gallery. The same content-addressed key as a gallery upload means
// re-using the identical file (gallery, or another section, or another UGC
// card) never duplicates the physical object. The bytes are authoritative
// — `kind` only selects which sniffer runs.
export async function uploadPageMedia(
  admin: AdminContext,
  productId: string,
  bytes: Buffer,
  kind: "image" | "video" | "gif" = "image",
) {
  await loadProductOr404(productId);
  const stored =
    kind === "video"
      ? await putVideoObject(bytes)
      : kind === "gif"
        ? await putGifObject(bytes)
        : await putImageObject(bytes);
  const mediaType = kind;

  await recordAudit(db, {
    adminUserId: admin.userId,
    action: "product.page_media_upload",
    entityType: "product",
    entityId: productId,
    metadata: {
      url: stored.url,
      storageKey: stored.storageKey,
      contentType: stored.contentType,
      byteSize: stored.byteSize,
      checksum: stored.checksum,
      mediaType,
    },
  });

  return { url: stored.url, contentType: stored.contentType, mediaType };
}

export async function saveProductPageDraft(admin: AdminContext, productId: string, input: unknown) {
  await loadProductOr404(productId);

  let doc: PageDocument;
  try {
    doc = parsePageDocument(input);
  } catch (error) {
    throw AppError.badRequest("Le document de la page est invalide.", { cause: describeZod(error) });
  }

  await assertImagesBelong(productId, doc);
  await loadOrCreateRow(productId);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(productPages)
      .set({ draft: doc, updatedAt: new Date(), updatedBy: admin.userId })
      .where(eq(productPages.productId, productId))
      .returning();
    if (!row) throw new Error("product_pages draft update returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.page_draft_save",
      entityType: "product",
      entityId: productId,
      metadata: { sections: doc.sections.map((s) => ({ id: s.id, type: s.type, enabled: s.enabled })) },
    });

    return mapProductPageAdmin(row);
  });
}

export async function publishProductPage(admin: AdminContext, productId: string) {
  const product = await loadProductOr404(productId);
  const row = await loadOrCreateRow(productId);

  let doc: PageDocument;
  try {
    doc = parsePageDocument(row.draft);
  } catch (error) {
    throw AppError.badRequest(
      "Le brouillon ne peut pas être publié : il est invalide. Corrigez-le puis réessayez.",
      { cause: describeZod(error) },
    );
  }
  await assertImagesBelong(productId, doc);

  const result = await db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx
      .update(productPages)
      .set({ published: doc, publishedAt: now, updatedAt: now, updatedBy: admin.userId })
      .where(eq(productPages.productId, productId))
      .returning();
    if (!updated) throw new Error("product_pages publish returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.page_publish",
      entityType: "product",
      entityId: productId,
      metadata: { sectionCount: doc.sections.length, wasFirstPublish: row.published == null },
    });

    return mapProductPageAdmin(updated);
  });

  // Best-effort, after commit: tell the storefront to drop its cached render.
  await revalidateStorefrontProductPage(product.handle);
  return result;
}

// Discard draft edits: reset the draft to whatever is currently published,
// or to the code-owned default document when nothing has been published.
export async function revertProductPageDraft(admin: AdminContext, productId: string) {
  await loadProductOr404(productId);
  const row = await loadOrCreateRow(productId);
  const target: PageDocument = row.published
    ? parsePageDocument(row.published)
    : DEFAULT_PAGE_DOCUMENT;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(productPages)
      .set({ draft: target, updatedAt: new Date(), updatedBy: admin.userId })
      .where(eq(productPages.productId, productId))
      .returning();
    if (!updated) throw new Error("product_pages revert returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.page_revert",
      entityType: "product",
      entityId: productId,
      metadata: { revertedTo: row.published ? "published" : "default" },
    });

    return mapProductPageAdmin(updated);
  });
}

// Called from media.ts inside the delete transaction: any media slot in the
// draft or published document that points at the deleted image is reset to
// an empty placeholder (keeping its alt text + placeholder label).
export async function clearImageFromProductPage(
  exec: DbOrTx,
  productId: string,
  imageId: string,
): Promise<void> {
  const [row] = await exec
    .select()
    .from(productPages)
    .where(eq(productPages.productId, productId))
    .limit(1);
  if (!row) return;

  const reset = (slot: MediaSlot): MediaSlot =>
    slot.kind === "image" && slot.imageId === imageId
      ? { ...slot, kind: "placeholder", imageId: null, url: "", poster: "", mediaType: "image", fileName: "" }
      : slot;

  const patch: { draft?: PageDocument; published?: PageDocument; updatedAt?: Date } = {};

  for (const key of ["draft", "published"] as const) {
    const value = row[key];
    if (!value) continue;
    let doc: PageDocument;
    try {
      doc = parsePageDocument(value);
    } catch {
      continue; // leave an unparseable document untouched
    }
    const next = mapDocumentMediaSlots(doc, reset);
    if (JSON.stringify(next) !== JSON.stringify(doc)) patch[key] = next;
  }

  if (patch.draft || patch.published) {
    patch.updatedAt = new Date();
    await exec.update(productPages).set(patch).where(eq(productPages.productId, productId));
  }
}

function describeZod(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues: unknown }).issues)) {
    return (error as { issues: { path: (string | number)[]; message: string }[] }).issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  }
  return "invalid document";
}
