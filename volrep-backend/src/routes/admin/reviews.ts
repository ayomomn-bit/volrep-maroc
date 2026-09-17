import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, adminOf } from "../../plugins/admin-auth.js";
import { listReviews, moderateReview, type ReviewStatus } from "../../services/admin/reviews.js";

const listQuerySchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    productId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

// `.strict()` is the guard that a caller cannot smuggle in
// `verifiedPurchase` (or `orderId`, `author`, `body`, …). The only
// mutable field is `status`.
const moderateSchema = z.object({ status: z.enum(["pending", "approved", "rejected"]) }).strict();

const idParams = z.object({ id: z.string().uuid() });

export async function adminReviewRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/reviews", async (request) => {
    const q = listQuerySchema.parse(request.query);
    return listReviews({
      status: q.status as ReviewStatus | undefined,
      productId: q.productId,
      limit: q.limit,
      offset: q.offset,
    });
  });

  app.patch("/api/admin/reviews/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const { status } = moderateSchema.parse(request.body);
    return { review: await moderateReview(adminOf(request), id, status) };
  });
}
