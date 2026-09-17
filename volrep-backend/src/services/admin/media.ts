import { createHash } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { productImages, products } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminImage } from "../../mappers/admin.js";
import { getMediaStorage } from "../../lib/media-storage/index.js";
import { detectImage, detectVideo, detectGif } from "../../lib/media-storage/image-detect.js";
import { assertImageDimensionsWithinLimits } from "../../lib/media-storage/image-dimensions.js";
import { env } from "../../config/env.js";
import { clearImageFromProductPage } from "./product-page.js";
import type { AdminContext } from "./auth.js";

const MAX_IMAGES_PER_PRODUCT = 20;

async function loadProductOr404(productId: string) {
  const [row] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!row) throw AppError.notFound("Product not found");
  return row;
}

async function loadImageOr404(productId: string, imageId: string) {
  const [row] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .limit(1);
  if (!row) throw AppError.notFound("Image not found for this product");
  return row;
}

async function currentImages(productId: string) {
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position), asc(productImages.createdAt));
}

// Rewrites position to 0..n-1 in the given id order, inside a tx.
async function applyOrder(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  orderedIds: string[],
): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await tx.update(productImages).set({ position: index }).where(eq(productImages.id, id));
  }
}

export type UploadResult = { image: ReturnType<typeof mapAdminImage>; deduped: boolean };

// Store raw image bytes on media storage under a content-addressed key and
// return the public URL. NO database row — the caller decides how it is
// referenced (a product_images row for the gallery via uploadProductMedia,
// or a "Page produit" media slot via uploadPageMedia). Both paths use this
// exact key scheme, so the same file uploaded to the gallery AND used in a
// landing-page section is one physical object, never duplicated.
export async function putImageObject(bytes: Buffer): Promise<{
  url: string;
  storageKey: string;
  contentType: string;
  checksum: string;
  byteSize: number;
}> {
  if (bytes.byteLength === 0) throw AppError.badRequest("Le fichier est vide.");
  if (bytes.byteLength > env.MEDIA_MAX_BYTES) {
    throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
  }
  const detected = detectImage(bytes);
  if (!detected) {
    throw AppError.badRequest("Format d’image non pris en charge (JPEG, PNG, WebP ou AVIF uniquement).");
  }
  assertImageDimensionsWithinLimits(bytes, detected.ext);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storage = getMediaStorage();
  const storageKey = `products/${checksum}.${detected.ext}`;
  if (!(await storage.exists(storageKey))) {
    await storage.put(storageKey, bytes, detected.contentType);
  }
  return {
    url: storage.publicUrl(storageKey),
    storageKey,
    contentType: detected.contentType,
    checksum,
    byteSize: bytes.byteLength,
  };
}

// Store raw MP4 bytes on media storage under a content-addressed key and
// return the public URL. Same key scheme as putImageObject, so the same
// clip re-used in several UGC cards (or elsewhere) is one physical object,
// never duplicated. NO database row — a "Page produit" media slot
// references it by URL and it never enters product_images / the gallery.
export async function putVideoObject(bytes: Buffer): Promise<{
  url: string;
  storageKey: string;
  contentType: string;
  checksum: string;
  byteSize: number;
}> {
  if (bytes.byteLength === 0) throw AppError.badRequest("Le fichier est vide.");
  if (bytes.byteLength > env.MEDIA_VIDEO_MAX_BYTES) {
    throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
  }
  const detected = detectVideo(bytes);
  if (!detected) {
    throw AppError.badRequest("Format vidéo non pris en charge (MP4 uniquement).");
  }
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storage = getMediaStorage();
  const storageKey = `products/${checksum}.${detected.ext}`;
  if (!(await storage.exists(storageKey))) {
    await storage.put(storageKey, bytes, detected.contentType);
  }
  return {
    url: storage.publicUrl(storageKey),
    storageKey,
    contentType: detected.contentType,
    checksum,
    byteSize: bytes.byteLength,
  };
}

// Store raw animated-GIF bytes on media storage under a content-addressed
// key and return the public URL. Same key scheme as putImageObject /
// putVideoObject, so the same GIF re-used in several sections is one
// physical object, never duplicated. NO database row — a "Page produit"
// media slot references it by URL and it never enters product_images /
// the gallery. The GIF is stored verbatim (image/gif) — never transcoded.
export async function putGifObject(bytes: Buffer): Promise<{
  url: string;
  storageKey: string;
  contentType: string;
  checksum: string;
  byteSize: number;
}> {
  if (bytes.byteLength === 0) throw AppError.badRequest("Le fichier est vide.");
  if (bytes.byteLength > env.MEDIA_GIF_MAX_BYTES) {
    throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
  }
  const detected = detectGif(bytes);
  if (!detected) {
    throw AppError.badRequest("Fichier GIF non valide (les octets ne correspondent pas à un GIF).");
  }
  assertImageDimensionsWithinLimits(bytes, "gif");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storage = getMediaStorage();
  const storageKey = `products/${checksum}.${detected.ext}`;
  if (!(await storage.exists(storageKey))) {
    await storage.put(storageKey, bytes, detected.contentType);
  }
  return {
    url: storage.publicUrl(storageKey),
    storageKey,
    contentType: detected.contentType,
    checksum,
    byteSize: bytes.byteLength,
  };
}

// Store an uploaded image on Volrep media storage and attach it to the
// product. The bytes are authoritative — declared MIME/filename are only
// a first-pass filter (validated in the route). Content-addressed key.
export async function uploadProductMedia(
  admin: AdminContext,
  productId: string,
  file: { bytes: Buffer; altText?: string | null },
): Promise<UploadResult> {
  await loadProductOr404(productId);

  if (file.bytes.byteLength === 0) throw AppError.badRequest("Le fichier est vide.");
  if (file.bytes.byteLength > env.MEDIA_MAX_BYTES) {
    throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
  }

  const detected = detectImage(file.bytes);
  if (!detected) {
    throw AppError.badRequest("Format d’image non pris en charge (JPEG, PNG, WebP ou AVIF uniquement).");
  }

  // Decompression-bomb guard — header-only, never decodes pixels (Step 3 §5).
  assertImageDimensionsWithinLimits(file.bytes, detected.ext);

  const checksum = createHash("sha256").update(file.bytes).digest("hex");

  const existing = await currentImages(productId);
  if (existing.length >= MAX_IMAGES_PER_PRODUCT) {
    throw AppError.badRequest(`Un produit ne peut pas avoir plus de ${MAX_IMAGES_PER_PRODUCT} images.`);
  }

  // Same bytes already attached to this product → return the existing row.
  const dupe = existing.find((img) => img.checksum === checksum);
  if (dupe) return { image: mapAdminImage(dupe), deduped: true };

  const storage = getMediaStorage();
  const key = `products/${checksum}.${detected.ext}`;
  if (!(await storage.exists(key))) {
    await storage.put(key, file.bytes, detected.contentType);
  }
  const url = storage.publicUrl(key);
  const nextPosition = existing.length;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productImages)
      .values({
        productId,
        url,
        altText: file.altText ?? null,
        position: nextPosition,
        storageKey: key,
        contentType: detected.contentType,
        checksum,
        byteSize: file.bytes.byteLength,
      })
      .returning();
    if (!row) throw new Error("Image insert returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.media_upload",
      entityType: "product",
      entityId: productId,
      metadata: { imageId: row.id, storageKey: key, contentType: detected.contentType, byteSize: file.bytes.byteLength, checksum },
    });

    return { image: mapAdminImage(row), deduped: false };
  });
}

export async function updateProductMedia(
  admin: AdminContext,
  productId: string,
  imageId: string,
  input: { altText: string | null },
): Promise<ReturnType<typeof mapAdminImage>> {
  const current = await loadImageOr404(productId, imageId);
  if ((input.altText ?? null) === (current.altText ?? null)) return mapAdminImage(current);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(productImages)
      .set({ altText: input.altText })
      .where(eq(productImages.id, imageId))
      .returning();
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.media_update",
      entityType: "product",
      entityId: productId,
      metadata: { imageId, altText: { from: current.altText, to: input.altText } },
    });
    return mapAdminImage(row!);
  });
}

// Full reorder — `orderedIds` must be exactly the product's current image
// ids, permuted. Position 0 is the primary/featured image.
export async function reorderProductMedia(
  admin: AdminContext,
  productId: string,
  orderedIds: string[],
): Promise<ReturnType<typeof mapAdminImage>[]> {
  await loadProductOr404(productId);
  const existing = await currentImages(productId);
  const existingIds = new Set(existing.map((i) => i.id));

  if (orderedIds.length !== existing.length || orderedIds.some((id) => !existingIds.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
    throw AppError.badRequest("La liste d’ordre doit contenir exactement les images du produit, sans doublon.");
  }

  await db.transaction(async (tx) => {
    await applyOrder(tx, orderedIds);
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.media_reorder",
      entityType: "product",
      entityId: productId,
      metadata: { order: orderedIds },
    });
  });

  return (await currentImages(productId)).map(mapAdminImage);
}

// Move one image to position 0 (primary), keeping the relative order of
// the rest.
export async function setPrimaryProductMedia(
  admin: AdminContext,
  productId: string,
  imageId: string,
): Promise<ReturnType<typeof mapAdminImage>[]> {
  await loadImageOr404(productId, imageId);
  const existing = await currentImages(productId);
  const reordered = [imageId, ...existing.map((i) => i.id).filter((id) => id !== imageId)];

  await db.transaction(async (tx) => {
    await applyOrder(tx, reordered);
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.media_set_primary",
      entityType: "product",
      entityId: productId,
      metadata: { imageId },
    });
  });

  return (await currentImages(productId)).map(mapAdminImage);
}

export async function deleteProductMedia(
  admin: AdminContext,
  productId: string,
  imageId: string,
): Promise<ReturnType<typeof mapAdminImage>[]> {
  const target = await loadImageOr404(productId, imageId);

  await db.transaction(async (tx) => {
    await tx.delete(productImages).where(eq(productImages.id, imageId));

    // Any "Page produit" media slot (draft or published) that pointed at
    // this image is reset to an empty placeholder, in the same tx.
    await clearImageFromProductPage(tx, productId, imageId);

    // Compact the remaining positions to 0..n-1.
    const rest = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.position), asc(productImages.createdAt));
    await applyOrder(tx, rest.map((r) => r.id));

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.media_delete",
      entityType: "product",
      entityId: productId,
      metadata: { imageId, storageKey: target.storageKey, url: target.url },
    });
  });

  // Delete the stored object only if it is Volrep-owned AND no other row
  // (any product) still points at the same storage key.
  if (target.storageKey) {
    const [stillUsed] = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(and(eq(productImages.storageKey, target.storageKey), ne(productImages.id, imageId)))
      .limit(1);
    if (!stillUsed) {
      await getMediaStorage().delete(target.storageKey);
    }
  }

  return (await currentImages(productId)).map(mapAdminImage);
}
