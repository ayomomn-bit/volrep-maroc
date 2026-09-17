import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { productLandingPages, products } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapLandingPage } from "../../mappers/admin.js";
import { getLiryaClient, liryaConfigured, LiryaError } from "../../lib/lirya/index.js";
import type { LiryaErrorCode } from "../../lib/lirya/index.js";
import type { LiryaPage } from "../../lib/lirya/types.js";
import type { AdminContext } from "./auth.js";

const LIRYA_PAGE_ID_RE = /^pg_[A-Za-z0-9_-]+$/;
const DEFAULT_ROLE = "primary";

type LandingRow = typeof productLandingPages.$inferSelect;

async function loadProductOr404(productId: string) {
  const [row] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!row) throw AppError.notFound("Product not found");
  return row;
}

function mapCtx(productId: string) {
  return { productId, adminBaseUrl: env.LIRYA_ADMIN_BASE_URL };
}

async function bindingRows(productId: string): Promise<LandingRow[]> {
  return db
    .select()
    .from(productLandingPages)
    .where(eq(productLandingPages.productId, productId))
    .orderBy(asc(productLandingPages.createdAt));
}

// Translate a Lirya transport error into the stable `sync_error` code the
// UI renders a French warning for. The binding is NEVER dropped for any of
// these — a page that becomes unavailable keeps its cached display fields.
function syncErrorCode(code: LiryaErrorCode): string {
  switch (code) {
    case "page_not_found":
      return "page_not_found";
    case "unauthorized":
      return "unauthorized";
    case "forbidden":
      return "insufficient_scope";
    case "rate_limited":
      return "rate_limited";
    default:
      return "unavailable";
  }
}

// The cache columns to write from a fresh Lirya page projection. Only
// display / identity fields — never HTML, structured content or lp_config.
function cacheFromPage(page: LiryaPage): Partial<typeof productLandingPages.$inferInsert> {
  const externalRefProductId =
    page.external_ref && typeof page.external_ref.product_id === "string" ? page.external_ref.product_id : null;
  return {
    // Lirya's real contract returns `version` as a number; the cache column
    // is text, so normalise explicitly.
    liryaVersion: page.version != null ? String(page.version) : null,
    cachedEtag: page.etag ?? null,
    cachedStatus: page.status ?? null,
    cachedPublicUrl: page.url ?? null,
    cachedSlug: page.slug ?? null,
    cachedName: page.name ?? null,
    cachedTemplate: page.template ?? null,
    cachedContentSource: page.content_source ?? null,
    cachedExternalRefProductId: externalRefProductId,
  };
}

// ---- read + best-effort refresh -----------------------------------

// Loads every binding for a product and, when `refresh` is set and Lirya
// is configured, does a best-effort conditional GET per binding to freshen
// the cache. NEVER throws on a Lirya failure — that is what keeps the
// Landing Pages tab (and, transitively, Product Studio) non-blocking.
export async function listProductLandingPages(
  productId: string,
  opts: { refresh?: boolean } = {},
) {
  await loadProductOr404(productId);
  let rows = await bindingRows(productId);

  const client = getLiryaClient();
  if (opts.refresh && client && rows.length > 0) {
    await Promise.all(
      rows.map(async (row) => {
        const now = new Date();
        try {
          const result = await client.getPage(row.liryaPageId, { etag: row.cachedEtag });
          if (result.status === 304) {
            await db
              .update(productLandingPages)
              .set({ lastCheckedAt: now, syncError: null, updatedAt: now })
              .where(eq(productLandingPages.id, row.id));
            return;
          }
          await db
            .update(productLandingPages)
            .set({ ...cacheFromPage(result.page), lastSyncedAt: now, lastCheckedAt: now, syncError: null, updatedAt: now })
            .where(eq(productLandingPages.id, row.id));
        } catch (err) {
          const code = err instanceof LiryaError ? syncErrorCode(err.code) : "unavailable";
          await db
            .update(productLandingPages)
            .set({ lastCheckedAt: now, syncError: code, updatedAt: now })
            .where(eq(productLandingPages.id, row.id));
        }
      }),
    );
    rows = await bindingRows(productId);
  }

  return rows.map((r) => mapLandingPage(r, mapCtx(productId)));
}

// ---- associate --------------------------------------------------

export type AssociateInput = { liryaPageId: string; role?: string | undefined };

export async function associateLandingPage(admin: AdminContext, productId: string, input: AssociateInput) {
  await loadProductOr404(productId);
  const role = (input.role ?? DEFAULT_ROLE).trim() || DEFAULT_ROLE;

  if (!LIRYA_PAGE_ID_RE.test(input.liryaPageId)) {
    throw AppError.badRequest("Identifiant de page Lirya invalide (attendu : pg_…).");
  }

  const client = getLiryaClient();
  if (!client) {
    throw new AppError(503, "LIRYA_NOT_CONFIGURED", "L’intégration Lirya n’est pas configurée.");
  }

  // One read to confirm the page exists and grab the fields to cache.
  let page: LiryaPage;
  try {
    const result = await client.getPage(input.liryaPageId);
    if (result.status === 304) {
      // No ETag was sent, so a 304 is unexpected — treat as unavailable.
      throw new AppError(502, "LIRYA_UNAVAILABLE", "Lirya est temporairement indisponible. Réessayez.");
    }
    page = result.page;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof LiryaError) {
      if (err.code === "page_not_found") {
        throw AppError.notFound("Page Lirya introuvable.");
      }
      if (err.code === "unauthorized" || err.code === "forbidden") {
        throw new AppError(502, "LIRYA_AUTH", "Accès à l’API Lirya refusé. Vérifiez la configuration.");
      }
      throw new AppError(502, "LIRYA_UNAVAILABLE", "Lirya est temporairement indisponible. Réessayez.");
    }
    throw err;
  }

  if (page.type && page.type !== "landing") {
    throw AppError.badRequest("Cette page Lirya n’est pas une page de destination.");
  }

  const now = new Date();
  let inserted: LandingRow;
  try {
    const [row] = await db.transaction(async (tx) => {
      const created = await tx
        .insert(productLandingPages)
        .values({
          productId,
          liryaPageId: input.liryaPageId,
          role,
          ...cacheFromPage(page),
          lastSyncedAt: now,
          lastCheckedAt: now,
          syncError: null,
        })
        .returning();
      if (!created[0]) throw new Error("landing page insert returned no row");

      await recordAudit(tx, {
        adminUserId: admin.userId,
        action: "landing_page.associated",
        entityType: "landing_page",
        entityId: created[0].id,
        metadata: {
          productId,
          liryaPageId: input.liryaPageId,
          role,
          pageName: page.name,
          pageStatus: page.status,
        },
      });
      return created;
    });
    inserted = row!;
  } catch (err) {
    if (isUniqueViolation(err, "product_landing_pages_product_role_unique")) {
      throw AppError.conflict(
        "LANDING_PAGE_ROLE_TAKEN",
        "Une page de destination principale est déjà associée à ce produit. Dissociez-la d’abord.",
      );
    }
    if (isUniqueViolation(err, "product_landing_pages_product_page_unique")) {
      throw AppError.conflict("LANDING_PAGE_ALREADY_LINKED", "Cette page Lirya est déjà associée à ce produit.");
    }
    throw err;
  }

  return mapLandingPage(inserted, mapCtx(productId));
}

// ---- unassociate ------------------------------------------------

export async function unassociateLandingPage(admin: AdminContext, productId: string, bindingId: string) {
  await loadProductOr404(productId);
  const [row] = await db
    .select()
    .from(productLandingPages)
    .where(and(eq(productLandingPages.id, bindingId), eq(productLandingPages.productId, productId)))
    .limit(1);
  if (!row) throw AppError.notFound("Landing page binding not found for this product");

  await db.transaction(async (tx) => {
    // Volrep only removes ITS OWN binding row. It never calls Lirya to
    // delete, unpublish or otherwise mutate the page (V1 is pages:read).
    await tx.delete(productLandingPages).where(eq(productLandingPages.id, bindingId));
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "landing_page.unassociated",
      entityType: "landing_page",
      entityId: bindingId,
      metadata: { productId, liryaPageId: row.liryaPageId, role: row.role },
    });
  });

  return bindingRows(productId).then((rows) => rows.map((r) => mapLandingPage(r, mapCtx(productId))));
}

// ---- Lirya page picker ----------------------------------------

export type ListLiryaPagesInput = { cursor?: string | undefined; limit?: number | undefined; q?: string | undefined };

export async function listLiryaPages(input: ListLiryaPagesInput = {}) {
  const client = getLiryaClient();
  if (!client) {
    throw new AppError(503, "LIRYA_NOT_CONFIGURED", "L’intégration Lirya n’est pas configurée.");
  }

  let result;
  try {
    // V1 association only offers PUBLISHED LANDING pages: drafts (currently
    // unrendered structured pages) and hidden pages are not publicly
    // available, so they are never proposed for binding.
    result = await client.listPages({
      type: "landing",
      status: "published",
      cursor: input.cursor ?? null,
      limit: input.limit ?? 50,
    });
  } catch (err) {
    if (err instanceof LiryaError) {
      if (err.code === "unauthorized" || err.code === "forbidden") {
        throw new AppError(502, "LIRYA_AUTH", "Accès à l’API Lirya refusé. Vérifiez la configuration.");
      }
      throw new AppError(502, "LIRYA_UNAVAILABLE", "Lirya est temporairement indisponible. Réessayez.");
    }
    throw err;
  }

  // Lirya has no free-text search in V1 — filter by name client-side.
  const q = input.q?.trim().toLowerCase();
  const pages = (q ? result.pages.filter((p) => p.name?.toLowerCase().includes(q)) : result.pages).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    template: p.template,
    url: p.url,
    updatedAt: p.updated_at ?? null,
  }));

  return { pages, nextCursor: result.nextCursor };
}

export { liryaConfigured };

// Postgres unique-violation detection (SQLSTATE 23505) for a named constraint.
function isUniqueViolation(err: unknown, constraint: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; constraint_name?: string; constraint?: string; message?: string };
  if (e.code !== "23505") return false;
  return e.constraint_name === constraint || e.constraint === constraint || (e.message?.includes(constraint) ?? false);
}
