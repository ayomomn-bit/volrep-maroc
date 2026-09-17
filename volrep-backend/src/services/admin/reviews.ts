import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { products, reviews } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminReview } from "../../mappers/admin.js";
import type { AdminContext } from "./auth.js";

export type ReviewStatus = "pending" | "approved" | "rejected";

export async function listReviews(opts: {
  status?: ReviewStatus | undefined;
  productId?: string | undefined;
  limit: number;
  offset: number;
}) {
  const conditions = [];
  if (opts.status) conditions.push(eq(reviews.status, opts.status));
  if (opts.productId) conditions.push(eq(reviews.productId, opts.productId));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ review: reviews, productTitle: products.title, productHandle: products.handle })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db.select({ value: count() }).from(reviews).where(where),
  ]);

  return {
    reviews: rows.map((r) => mapAdminReview(r.review, { title: r.productTitle, handle: r.productHandle })),
    total: totalRow?.value ?? 0,
    limit: opts.limit,
    offset: opts.offset,
  };
}

// Moderation is the ONLY thing an admin can do to a review. There is no
// create/edit-body path — the backend never fabricates reviews
// (Architecture §09). `verified_purchase` is a generated column
// (`order_id IS NOT NULL`) and cannot be written by any statement, so
// there is nothing to guard against here beyond simply never accepting it
// as input (the Zod schema in the route rejects unknown fields).
export async function moderateReview(admin: AdminContext, reviewId: string, nextStatus: ReviewStatus) {
  const [current] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!current) throw AppError.notFound("Review not found");

  if (current.status === nextStatus) {
    throw new AppError(409, "NO_STATUS_CHANGE", `Review is already ${nextStatus}.`);
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(reviews)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId))
      .returning();
    if (!row) throw new Error("Review update returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: `review.${nextStatus === "approved" ? "approve" : nextStatus === "rejected" ? "reject" : "unpublish"}`,
      entityType: "review",
      entityId: reviewId,
      metadata: { from: current.status, to: nextStatus, productId: current.productId },
    });

    return mapAdminReview(row);
  });
}
