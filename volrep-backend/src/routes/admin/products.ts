import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { requireAdmin, requireOwner, adminOf } from "../../plugins/admin-auth.js";
import {
  createProduct,
  getProductDetail,
  listProducts,
  replaceImages,
  replaceOptions,
  updateProduct,
  type ProductStatus,
} from "../../services/admin/products.js";
import { createVariant, deleteVariant, updateVariant } from "../../services/admin/variants.js";
import { adjustInventory, inventoryHistory } from "../../services/admin/inventory.js";
import {
  deleteProductMedia,
  reorderProductMedia,
  setPrimaryProductMedia,
  updateProductMedia,
  uploadProductMedia,
} from "../../services/admin/media.js";
import { declaredPairLooksValid } from "../../lib/media-storage/image-detect.js";
import { env } from "../../config/env.js";

const PRODUCT_STATUS = ["draft", "active", "archived"] as const;
const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONEY_RE = /^\d{1,8}(\.\d{1,2})?$/;

const idParams = z.object({ id: z.string().uuid() });
const variantIdParams = z.object({ variantId: z.string().uuid() });
const mediaParams = z.object({ id: z.string().uuid(), imageId: z.string().uuid() });

const listQuerySchema = z
  .object({
    status: z.enum(PRODUCT_STATUS).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

const createProductSchema = z
  .object({
    handle: z.string().min(1).max(200).regex(HANDLE_RE, "Handle must be lowercase, digits and single hyphens."),
    title: z.string().min(1).max(300),
    description: z.string().max(20000).optional(),
    productType: z.string().max(120).optional(),
    tags: z.array(z.string().min(1).max(60)).max(50).optional(),
    status: z.enum(PRODUCT_STATUS).optional(),
  })
  .strict();

const updateProductSchema = z
  .object({
    handle: z.string().min(1).max(200).regex(HANDLE_RE, "Handle must be lowercase, digits and single hyphens.").optional(),
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(20000).optional(),
    productType: z.string().max(120).optional(),
    tags: z.array(z.string().min(1).max(60)).max(50).optional(),
    status: z.enum(PRODUCT_STATUS).optional(),
    // `subtitle` (accroche) is kept as product metadata. The richer
    // marketing fields (marketingCopy / benefits / sellingPoints / seo*)
    // were removed from Product Studio — that content lives in Lirya — so
    // they are no longer accepted here (the DB columns still exist).
    subtitle: z.string().max(300).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update.");

const mediaReorderSchema = z.object({ order: z.array(z.string().uuid()).min(1).max(20) }).strict();
const mediaUpdateSchema = z.object({ altText: z.string().max(500).nullable() }).strict();

const optionsSchema = z
  .object({
    options: z
      .array(
        z.object({
          name: z.string().min(1).max(60),
          values: z.array(z.string().min(1).max(120)).min(1).max(50),
          position: z.number().int().min(0).optional(),
        }),
      )
      .max(10),
  })
  .strict();

const imagesSchema = z
  .object({
    images: z
      .array(
        z.object({
          url: z.string().url().max(2000),
          altText: z.string().max(500).nullable().optional(),
          width: z.number().int().positive().nullable().optional(),
          height: z.number().int().positive().nullable().optional(),
          position: z.number().int().min(0).optional(),
        }),
      )
      .max(20),
  })
  .strict();

const selectedOptionsSchema = z
  .array(z.object({ name: z.string().min(1).max(60), value: z.string().min(1).max(120) }))
  .max(10);

const createVariantSchema = z
  .object({
    title: z.string().min(1).max(200),
    sku: z.string().min(1).max(120).nullable().optional(),
    priceAmount: z.string().regex(MONEY_RE, "Price must be a non-negative amount, max 2 decimals."),
    priceCurrency: z.string().length(3).optional(),
    compareAtAmount: z.string().regex(MONEY_RE).nullable().optional(),
    stock: z.number().int().min(0).optional(),
    availableForSale: z.boolean().optional(),
    selectedOptions: selectedOptionsSchema.optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict();

const updateVariantSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    sku: z.string().min(1).max(120).nullable().optional(),
    priceAmount: z.string().regex(MONEY_RE).optional(),
    priceCurrency: z.string().length(3).optional(),
    compareAtAmount: z.string().regex(MONEY_RE).nullable().optional(),
    availableForSale: z.boolean().optional(),
    selectedOptions: selectedOptionsSchema.optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update.");

const inventorySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("set"), quantity: z.number().int().min(0).max(1_000_000), reason: z.string().min(1).max(300) }).strict(),
  z
    .object({ mode: z.literal("adjust"), delta: z.number().int().min(-1_000_000).max(1_000_000), reason: z.string().min(1).max(300) })
    .strict(),
]);

export async function adminProductRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/products", async (request) => {
    const q = listQuerySchema.parse(request.query);
    return listProducts({ status: q.status as ProductStatus | undefined, limit: q.limit, offset: q.offset });
  });

  app.get("/api/admin/products/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return { product: await getProductDetail(id) };
  });

  // OWNER-only: creating a new catalog entry.
  app.post("/api/admin/products", { preHandler: requireOwner }, async (request, reply) => {
    const body = createProductSchema.parse(request.body);
    reply.status(201);
    return { product: await createProduct(adminOf(request), body) };
  });

  app.patch("/api/admin/products/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const body = updateProductSchema.parse(request.body);
    // Content edits (title/description/type/tags) are STAFF-ok, but
    // changing `status` publishes/unpublishes/archives the product on the
    // live storefront — OWNER-only.
    if (body.status !== undefined && adminOf(request).role !== "owner") {
      throw AppError.forbidden("Changing a product's status requires an owner account");
    }
    return { product: await updateProduct(adminOf(request), id, body) };
  });

  app.put("/api/admin/products/:id/options", async (request) => {
    const { id } = idParams.parse(request.params);
    const body = optionsSchema.parse(request.body);
    return { product: await replaceOptions(adminOf(request), id, body.options) };
  });

  app.put("/api/admin/products/:id/images", async (request) => {
    const { id } = idParams.parse(request.params);
    const body = imagesSchema.parse(request.body);
    return { product: await replaceImages(adminOf(request), id, body.images) };
  });

  app.post("/api/admin/products/:id/variants", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = createVariantSchema.parse(request.body);
    reply.status(201);
    return { variant: await createVariant(adminOf(request), id, body) };
  });

  app.patch("/api/admin/variants/:variantId", async (request) => {
    const { variantId } = variantIdParams.parse(request.params);
    const body = updateVariantSchema.parse(request.body);
    return { variant: await updateVariant(adminOf(request), variantId, body) };
  });

  // Hard delete. Same content-editing tier as create/update (requireAdmin).
  // The service refuses a product's last variant (409 LAST_VARIANT) and a
  // variant held by an active cart (409 VARIANT_IN_CART); order history is
  // unaffected (order_line_items.variant_id is ON DELETE SET NULL).
  app.delete("/api/admin/variants/:variantId", async (request) => {
    const { variantId } = variantIdParams.parse(request.params);
    return deleteVariant(adminOf(request), variantId);
  });

  app.post("/api/admin/variants/:variantId/inventory", async (request) => {
    const { variantId } = variantIdParams.parse(request.params);
    const body = inventorySchema.parse(request.body);
    return { variant: await adjustInventory(adminOf(request), variantId, body) };
  });

  app.get("/api/admin/variants/:variantId/inventory", async (request) => {
    const { variantId } = variantIdParams.parse(request.params);
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(request.query);
    return { history: await inventoryHistory(variantId, q.limit) };
  });

  // ---- Volrep-owned product media (Phase 7C-2) ----------------------

  // Multipart upload. The parser is told THIS route's exact byte cap
  // (env.MEDIA_MAX_BYTES) so an oversized file is cut off mid-stream and
  // never fully buffered; `part.file.truncated` then rejects it. Per-IP
  // rate limit on top of the global 100/min (security hardening — Step 3).
  app.post(
    "/api/admin/products/:id/media",
    {
      config: {
        rateLimit: { max: env.MEDIA_UPLOAD_RATE_MAX, timeWindow: env.MEDIA_UPLOAD_RATE_TIME_WINDOW },
      },
    },
    async (request, reply) => {
      const { id } = idParams.parse(request.params);

      const part = await request.file({
        limits: { fileSize: env.MEDIA_MAX_BYTES },
        throwFileSizeLimit: false,
      });
      if (!part) throw AppError.badRequest("Aucun fichier reçu (champ multipart « file » attendu).");
      if (!declaredPairLooksValid(part.mimetype, part.filename ?? "")) {
        throw AppError.badRequest("Type de fichier non autorisé (JPEG, PNG, WebP ou AVIF).");
      }

      const bytes = await part.toBuffer();
      if (part.file.truncated || bytes.byteLength > env.MEDIA_MAX_BYTES) {
        throw new AppError(413, "MEDIA_TOO_LARGE", "Le fichier dépasse la taille maximale autorisée.");
      }

      // Alt text is set afterwards via PATCH .../media/:imageId — keeping the
      // upload a pure single-file POST avoids multipart field-ordering pitfalls.
      const result = await uploadProductMedia(adminOf(request), id, { bytes, altText: null });
      reply.status(result.deduped ? 200 : 201);
      return result;
    },
  );

  app.patch("/api/admin/products/:id/media/:imageId", async (request) => {
    const { id, imageId } = mediaParams.parse(request.params);
    const body = mediaUpdateSchema.parse(request.body);
    return { image: await updateProductMedia(adminOf(request), id, imageId, body) };
  });

  app.put("/api/admin/products/:id/media/order", async (request) => {
    const { id } = idParams.parse(request.params);
    const body = mediaReorderSchema.parse(request.body);
    return { images: await reorderProductMedia(adminOf(request), id, body.order) };
  });

  app.put("/api/admin/products/:id/media/:imageId/primary", async (request) => {
    const { id, imageId } = mediaParams.parse(request.params);
    return { images: await setPrimaryProductMedia(adminOf(request), id, imageId) };
  });

  app.delete("/api/admin/products/:id/media/:imageId", async (request) => {
    const { id, imageId } = mediaParams.parse(request.params);
    return { images: await deleteProductMedia(adminOf(request), id, imageId) };
  });
}
