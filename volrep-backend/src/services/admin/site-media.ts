import { createHash } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { siteMedia } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { getMediaStorage } from "../../lib/media-storage/index.js";
import { detectImage, detectVideo, detectGif } from "../../lib/media-storage/image-detect.js";
import {
  assertImageDimensionsWithinLimits,
  readImageDimensions,
} from "../../lib/media-storage/image-dimensions.js";
import { mapSiteMedia } from "../../mappers/admin.js";
import { env } from "../../config/env.js";
import type { AdminContext } from "./auth.js";

// ---------------------------------------------------------------------------
// Site media — the product-INDEPENDENT asset store for Homepage Studio.
//
// Reuses the exact low-level media infrastructure the product gallery / "Page
// produit" uploads use (getMediaStorage, the byte sniffers, the
// decompression-bomb guard) but:
//   - stores objects under `site/<sha256>.<ext>`, never `products/`
//   - writes rows to `site_media`, never `product_images`
//
// So a homepage upload can never surface in a product gallery, and a
// `product_images` id is never a valid homepage media reference (it simply
// is not in this table — see assertSiteMediaExists).
// ---------------------------------------------------------------------------

type SiteMediaRow = typeof siteMedia.$inferSelect;
export type SiteMediaKind = "image" | "video" | "gif";

async function loadOr404(id: string): Promise<SiteMediaRow> {
  const [row] = await db.select().from(siteMedia).where(eq(siteMedia.id, id)).limit(1);
  if (!row) throw AppError.notFound("Média introuvable.");
  return row;
}

// Detect + size-check the bytes for the declared kind, returning the storage
// facts. The bytes are authoritative — `kind` only selects which sniffer runs.
function inspect(bytes: Buffer, kind: SiteMediaKind): {
  ext: string;
  contentType: string;
  width: number | null;
  height: number | null;
} {
  if (bytes.byteLength === 0) throw AppError.badRequest("Le fichier est vide.");

  if (kind === "video") {
    if (bytes.byteLength > env.MEDIA_VIDEO_MAX_BYTES) {
      throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
    }
    const detected = detectVideo(bytes);
    if (!detected) throw AppError.badRequest("Format vidéo non pris en charge (MP4 ou WebM uniquement).");
    return { ext: detected.ext, contentType: detected.contentType, width: null, height: null };
  }

  if (kind === "gif") {
    if (bytes.byteLength > env.MEDIA_GIF_MAX_BYTES) {
      throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
    }
    const detected = detectGif(bytes);
    if (!detected) throw AppError.badRequest("Fichier GIF non valide (les octets ne correspondent pas à un GIF).");
    assertImageDimensionsWithinLimits(bytes, "gif");
    const dims = readImageDimensions(bytes, "gif");
    return { ext: detected.ext, contentType: detected.contentType, width: dims?.width ?? null, height: dims?.height ?? null };
  }

  if (bytes.byteLength > env.MEDIA_MAX_BYTES) {
    throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
  }
  const detected = detectImage(bytes);
  if (!detected) {
    throw AppError.badRequest("Format d’image non pris en charge (JPEG, PNG, WebP ou AVIF uniquement).");
  }
  assertImageDimensionsWithinLimits(bytes, detected.ext);
  const dims = readImageDimensions(bytes, detected.ext);
  return { ext: detected.ext, contentType: detected.contentType, width: dims?.width ?? null, height: dims?.height ?? null };
}

export type SiteMediaUploadResult = { media: ReturnType<typeof mapSiteMedia>; deduped: boolean };

// Store an uploaded image / animated GIF / MP4 for use in a homepage media
// slot. Content-addressed key under `site/`; the same bytes re-uploaded
// return the existing row.
export async function uploadSiteMedia(
  admin: AdminContext,
  bytes: Buffer,
  kind: SiteMediaKind,
  meta: { originalFilename?: string | null; altText?: string | null } = {},
): Promise<SiteMediaUploadResult> {
  const { ext, contentType, width, height } = inspect(bytes, kind);
  const checksum = createHash("sha256").update(bytes).digest("hex");

  // Same bytes already in site_media → return that row (dedupe).
  const [existing] = await db.select().from(siteMedia).where(eq(siteMedia.checksum, checksum)).limit(1);
  if (existing) return { media: mapSiteMedia(existing), deduped: true };

  const storage = getMediaStorage();
  const storageKey = `site/${checksum}.${ext}`;
  if (!(await storage.exists(storageKey))) {
    await storage.put(storageKey, bytes, contentType);
  }
  const url = storage.publicUrl(storageKey);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(siteMedia)
      .values({
        url,
        storageKey,
        contentType,
        checksum,
        byteSize: bytes.byteLength,
        width,
        height,
        mediaType: kind,
        originalFilename: (meta.originalFilename ?? "").slice(0, 400),
        altText: (meta.altText ?? "").slice(0, 400),
        createdBy: admin.userId,
      })
      .onConflictDoNothing({ target: siteMedia.storageKey })
      .returning();

    // A concurrent upload of the identical file won the race — fetch its row.
    const media =
      row ??
      (await tx.select().from(siteMedia).where(eq(siteMedia.storageKey, storageKey)).limit(1))[0];
    if (!media) throw new Error("site_media insert returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "site_media.upload",
      entityType: "site_media",
      entityId: media.id,
      metadata: { storageKey, contentType, byteSize: bytes.byteLength, checksum, mediaType: kind },
    });

    return { media: mapSiteMedia(media), deduped: !row };
  });
}

// Remove a site_media row. The stored object is deleted only when no other
// row still points at the same content-addressed key.
export async function deleteSiteMedia(admin: AdminContext, id: string): Promise<{ deleted: true; id: string }> {
  const target = await loadOr404(id);

  await db.transaction(async (tx) => {
    await tx.delete(siteMedia).where(eq(siteMedia.id, id));
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "site_media.delete",
      entityType: "site_media",
      entityId: id,
      metadata: { storageKey: target.storageKey, contentType: target.contentType },
    });
  });

  const [stillUsed] = await db
    .select({ id: siteMedia.id })
    .from(siteMedia)
    .where(and(eq(siteMedia.storageKey, target.storageKey), ne(siteMedia.id, id)))
    .limit(1);
  if (!stillUsed) {
    await getMediaStorage().delete(target.storageKey);
  }

  return { deleted: true, id };
}

export async function listSiteMedia(): Promise<ReturnType<typeof mapSiteMedia>[]> {
  const rows = await db.select().from(siteMedia).orderBy(siteMedia.createdAt);
  return rows.map(mapSiteMedia);
}

// Every id must be a real site_media row. A `product_images` id is rejected
// here for free — it is not in this table. This is the guarantee that a
// homepage media slot can never reference a product gallery image.
export async function assertSiteMediaExists(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await db.select({ id: siteMedia.id }).from(siteMedia).where(inArray(siteMedia.id, ids));
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw AppError.badRequest(
      "Un média sélectionné n’existe pas dans la bibliothèque de médias du site. " +
        "Les images de la galerie produit ne peuvent pas être utilisées ici.",
      { missing },
    );
  }
}

// Resolve `kind:"image"` site-media ids to public URLs — used by the
// storefront read (src/services/homepage.ts). Returns a Map keyed by id.
export async function resolveSiteMediaUrls(
  ids: string[],
): Promise<Map<string, { url: string; altText: string; mediaType: string }>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: siteMedia.id,
      url: siteMedia.url,
      altText: siteMedia.altText,
      mediaType: siteMedia.mediaType,
    })
    .from(siteMedia)
    .where(inArray(siteMedia.id, ids));
  return new Map(
    rows.map((r) => [r.id, { url: r.url, altText: r.altText, mediaType: r.mediaType }]),
  );
}
