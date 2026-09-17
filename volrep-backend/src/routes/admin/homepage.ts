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
  getHomepageForAdmin,
  mintHomepagePreviewTokenForAdmin,
  publishHomepage,
  revertHomepageDraft,
  saveHomepageDraft,
} from "../../services/admin/homepage.js";
import { deleteSiteMedia, listSiteMedia, uploadSiteMedia } from "../../services/admin/site-media.js";

// Homepage Studio — the editable storefront homepage. Draft / publish /
// revert + the product-independent site-media library.
//
// requireAdmin (staff + owner) — same content-editing tier as Product
// Studio's "Page produit" routes. Nothing here touches commerce, cart,
// checkout, COD, product_images or the product catalog.
const draftBody = z.object({ document: z.record(z.unknown()) });
const mediaIdParams = z.object({ id: z.string().uuid() });

export async function adminHomepageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/homepage", async () => {
    return getHomepageForAdmin();
  });

  app.put("/api/admin/homepage", async (request) => {
    const { document } = draftBody.parse(request.body);
    return saveHomepageDraft(adminOf(request), document);
  });

  app.post("/api/admin/homepage/publish", async (request) => {
    return publishHomepage(adminOf(request));
  });

  app.post("/api/admin/homepage/revert", async (request) => {
    return revertHomepageDraft(adminOf(request));
  });

  // Mint a short-lived token the admin UI appends to a storefront preview
  // URL to view the UNPUBLISHED draft. The token is scoped to the homepage
  // and expires; it grants nothing beyond "render the homepage draft".
  app.post("/api/admin/homepage/preview-token", async () => {
    return mintHomepagePreviewTokenForAdmin();
  });

  app.get("/api/admin/homepage/media", async () => {
    return { media: await listSiteMedia() };
  });

  // Upload an image, an animated GIF, OR an MP4 video for a homepage media
  // slot. Stored on media storage under `site/<sha>.<ext>` and written to
  // `site_media` — NEVER `product_images`, so a homepage asset can never
  // leak into a product gallery. Same multipart contract as the "Page
  // produit" media upload.
  app.post(
    "/api/admin/homepage/media",
    {
      config: {
        rateLimit: { max: env.MEDIA_UPLOAD_RATE_MAX, timeWindow: env.MEDIA_UPLOAD_RATE_TIME_WINDOW },
      },
    },
    async (request, reply) => {
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
        throw AppError.badRequest(
          "Type de fichier non autorisé (image JPEG/PNG/WebP/AVIF, GIF animé ou vidéo MP4).",
        );
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
      return uploadSiteMedia(adminOf(request), bytes, isVideo ? "video" : isGif ? "gif" : "image", {
        originalFilename: filename,
      });
    },
  );

  app.delete("/api/admin/homepage/media/:id", async (request) => {
    const { id } = mediaIdParams.parse(request.params);
    return deleteSiteMedia(adminOf(request), id);
  });
}
