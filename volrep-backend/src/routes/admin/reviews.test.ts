import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin, seedOrder } from "../../test/admin.js";
import { seedProduct } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, reviews } from "../../db/schema/index.js";

describe("Admin review moderation API", () => {
  let app: FastifyInstance;
  let session: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    session = (await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" })).sessionId;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  async function seedReview(productId: string, overrides: Partial<typeof reviews.$inferInsert> = {}) {
    const [row] = await db
      .insert(reviews)
      .values({ productId, author: "Reviewer", email: "r@example.test", rating: 5, body: "Solid.", ...overrides })
      .returning();
    return row!;
  }

  it("lists pending reviews and can filter by status", async () => {
    const product = await seedProduct({ handle: "rev-1" });
    await seedReview(product.id, { status: "pending" });
    await seedReview(product.id, { status: "approved", author: "Approved One" });

    const pending = await app.inject(asAdmin(session, { method: "GET", url: "/api/admin/reviews?status=pending" }));
    expect(pending.statusCode).toBe(200);
    expect(pending.json().reviews).toHaveLength(1);
    expect(pending.json().reviews[0].status).toBe("pending");

    const all = await app.inject(asAdmin(session, { method: "GET", url: "/api/admin/reviews" }));
    expect(all.json().total).toBe(2);
  });

  it("approves a pending review — it then appears on the public storefront", async () => {
    const product = await seedProduct({ handle: "rev-approve", status: "active" });
    const review = await seedReview(product.id, { status: "pending", body: "Approve me" });

    const before = await app.inject(withAuth({ method: "GET", url: "/api/reviews/rev-approve" }));
    expect(before.json().reviewCount).toBe(0);

    const res = await app.inject(
      asAdmin(session, { method: "PATCH", url: `/api/admin/reviews/${review.id}`, payload: { status: "approved" } }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().review.status).toBe("approved");

    const after = await app.inject(withAuth({ method: "GET", url: "/api/reviews/rev-approve" }));
    expect(after.json().reviewCount).toBe(1);
    expect(after.json().reviews[0].body).toBe("Approve me");
    // public payload never leaks the moderation email
    expect(JSON.stringify(after.json())).not.toMatch(/r@example\.test|"email"/);

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "review.approve"));
    expect(audit).toMatchObject({ entityType: "review", entityId: review.id });
  });

  it("rejects (unpublishes) an approved review — it disappears from the storefront", async () => {
    const product = await seedProduct({ handle: "rev-reject", status: "active" });
    const review = await seedReview(product.id, { status: "approved" });

    const res = await app.inject(
      asAdmin(session, { method: "PATCH", url: `/api/admin/reviews/${review.id}`, payload: { status: "rejected" } }),
    );
    expect(res.statusCode).toBe(200);

    const pub = await app.inject(withAuth({ method: "GET", url: "/api/reviews/rev-reject" }));
    expect(pub.json().reviewCount).toBe(0);

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "review.reject"));
    expect(audit).toBeDefined();
  });

  it("verified_purchase cannot be forged: it stays false with no order, true only via a real order link", async () => {
    const product = await seedProduct({ handle: "rev-verified", status: "active" });

    // no order → false, and the API rejects an attempt to send the field
    const unbacked = await seedReview(product.id, { status: "pending" });
    const forge = await app.inject(
      asAdmin(session, {
        method: "PATCH",
        url: `/api/admin/reviews/${unbacked.id}`,
        payload: { status: "approved", verifiedPurchase: true },
      }),
    );
    expect(forge.statusCode).toBe(400); // strict schema rejects the unknown key

    await app.inject(
      asAdmin(session, { method: "PATCH", url: `/api/admin/reviews/${unbacked.id}`, payload: { status: "approved" } }),
    );
    const [stillFalse] = await db.select().from(reviews).where(eq(reviews.id, unbacked.id));
    expect(stillFalse?.verifiedPurchase).toBe(false);

    // a review linked to a real order IS verified — by the DB, not the admin
    const { orderId } = await seedOrder();
    const backed = await seedReview(product.id, { status: "pending", orderId, author: "Real Buyer" });
    await app.inject(
      asAdmin(session, { method: "PATCH", url: `/api/admin/reviews/${backed.id}`, payload: { status: "approved" } }),
    );
    const [verified] = await db.select().from(reviews).where(eq(reviews.id, backed.id));
    expect(verified?.verifiedPurchase).toBe(true);
  });

  it("there is no admin endpoint that creates a review", async () => {
    const product = await seedProduct({ handle: "no-create" });
    const res = await app.inject(
      asAdmin(session, {
        method: "POST",
        url: "/api/admin/reviews",
        payload: { productId: product.id, author: "Fake", rating: 5, body: "fabricated" },
      }),
    );
    expect(res.statusCode).toBe(404);
  });
});
