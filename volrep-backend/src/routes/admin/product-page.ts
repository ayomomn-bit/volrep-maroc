import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import {
  declaredPairLooksValid,
  declaredVideoPairLooksValid,
  declaredGifPairLooksValid,
} from "../../lib/media-storage/image-detect.js";
import { requireAdmin, adminOf } from "../../plugins/admin-auth.js";
import {
  getProductPageForAdmin,
  mintProductPagePreviewToken,
  publishProductPage,
  revertProductPageDraft,
  saveProductPageDraft,
  uploadPageMedia,
} from "../../services/admin/product-page.js";

const idParams = z.object({ id: z.string().uuid() });
// The document body is validated in depth by the service layer
// (parsePageDocument); here we only require an object envelope.
const draftBody = z.object({ document: z.record(z.unknown()) });

// Product Studio "Page produit" — the editable long-form product landing
// page. Draft / publish / revert live here; the read-only Studio aggregate
// stays in ./studio.ts and the storefront read is ../product-page.ts.
//
// requireAdmin (staff + owner) — same content-editing tier as the product
// media / description routes. Publishing the PAGE is content, distinct from
// changing the product's `status` (which stays owner-only, untouched).
//
// Nothing here touches commerce, cart, checkout, COD or the Lirya API.
export async function adminProductPageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/products/:id/page", async (request) => {
    const { id } = idParams.parse(request.params);
    return getProductPageForAdmin(id);
  });

  app.put("/api/admin/products/:id/page/draft", async (request) => {
    const { id } = idParams.parse(request.params);
    const { document } = draftBody.parse(request.body);
    return saveProductPageDraft(adminOf(request), id, document);
  });

  app.post("/api/admin/products/:id/page/publish", async (request) => {
    const { id } = idParams.parse(request.params);
    return publishProductPage(adminOf(request), id);
  });

  app.post("/api/admin/products/:id/page/revert", async (request) => {
    const { id } = idParams.parse(request.params);
    return revertProductPageDraft(adminOf(request), id);
  });

  // Mint a short-lived token the admin UI appends to a storefront preview
  // URL to view the UNPUBLISHED draft. The token is bound to this product
  // and expires; it grants nothing beyond "render product X's draft".
  app.post("/api/admin/products/:id/page/preview-token", async (request) => {
    const { id } = idParams.parse(request.params);
    return mintProductPagePreviewToken(id);
  });

  // Upload an image, an animated GIF, OR an MP4 video for a "Page produit"
  // media slot. Stored on media storage and returned as a URL — NOT written
  // to product_images, so a landing-page section asset never leaks into the
  // product gallery. Same multipart contract as the gallery upload
  // (POST /api/admin/products/:id/media); the gallery stays images-only.
  app.post(
    "/api/admin/products/:id/page/media",
    {
      // Per-IP rate limit on top of the global 100/min (security hardening
      // — Step 3). Generous enough for a full Studio editing session.
      config: {
        rateLimit: { max: env.MEDIA_UPLOAD_RATE_MAX, timeWindow: env.MEDIA_UPLOAD_RATE_TIME_WINDOW },
      },
    },
    async (request, reply) => {
      const { id } = idParams.parse(request.params);

      // Cap the parser at the largest thing this route accepts (a video);
      // the exact per-type cap is enforced on the buffered bytes below, so
      // an oversized image/GIF is still rejected — it is just not streamed
      // past the video ceiling first.
      const part = await request.file({
        limits: {
          fileSize: Math.max(env.MEDIA_MAX_BYTES, env.MEDIA_VIDEO_MAX_BYTES, env.MEDIA_GIF_MAX_BYTES),
        },
        throwFileSizeLimit: false,
      });
      if (!part) throw AppError.badRequest("Aucun fichier reçu (champ multipart « file » attendu).");

      const filename = part.filename ?? "";
      const isVideo = declaredVideoPairLooksValid(part.mimetype, filename);
      const isGif = declaredGifPairLooksValid(part.mimetype, filename);
      const isImage = declaredPairLooksValid(part.mimetype, filename);
      if (!isImage && !isVideo && !isGif) {
        throw AppError.badRequest("Type de fichier non autorisé (image JPEG/PNG/WebP/AVIF, GIF animé ou vidéo MP4).");
      }

      const bytes = await part.toBuffer();
      const cap = isVideo
        ? env.MEDIA_VIDEO_MAX_BYTES
        : isGif
          ? env.MEDIA_GIF_MAX_BYTES
          : env.MEDIA_MAX_BYTES;
      if (part.file.truncated || bytes.byteLength > cap) {
        throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
      }
      if (bytes.byteLength === 0) throw AppError.badRequest("Le fichier est vide.");

      reply.status(201);
      return uploadPageMedia(adminOf(request), id, bytes, isVideo ? "video" : isGif ? "gif" : "image");
    },
  );
}
