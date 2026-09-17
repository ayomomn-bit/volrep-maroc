import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedProduct } from "../test/seed.js";
import { closeDb, db } from "../db/client.js";
import { orders, checkoutSessions, carts, reviews, reviewMedia } from "../db/schema/index.js";

describe("Reviews API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeDb();
  });

  async function seedPaidOrder(email: string) {
    const [cart] = await db.insert(carts).values({ expiresAt: new Date(Date.now() + 86_400_000), status: "converted" }).returning();
    const [session] = await db
      .insert(checkoutSessions)
      .values({
        cartId: cart!.id,
        provider: "cod",
        providerSessionId: crypto.randomUUID(),
        status: "completed",
        amountTotal: "1.00",
        currency: "MAD",
        shippingAddress: {},
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    const [order] = await db
      .insert(orders)
      .values({
        checkoutSessionId: session!.id,
        email,
        phone: "+212600000000",
        subtotalAmount: "1.00",
        totalAmount: "1.00",
        currency: "MAD",
        shippingAddress: {},
        paymentProvider: "cod",
      })
      .returning();
    return order!;
  }

  it("returns 404 for an unknown product handle", async () => {
    const response = await app.inject(withAuth({ method: "GET", url: "/api/reviews/does-not-exist" }));
    expect(response.statusCode).toBe(404);
  });

  it("returns an honest empty state when there are no approved reviews", async () => {
    await seedProduct();
    const response = await app.inject(withAuth({ method: "GET", url: "/api/reviews/volrep-prm" }));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reviews: [], averageRating: null, reviewCount: 0 });
  });

  it("returns only approved reviews, excluding pending and rejected", async () => {
    const product = await seedProduct();
    await db.insert(reviews).values([
      { productId: product.id, author: "Approved One", rating: 5, body: "Great", status: "approved" },
      { productId: product.id, author: "Pending One", rating: 4, body: "Ok", status: "pending" },
      { productId: product.id, author: "Rejected One", rating: 1, body: "Spam", status: "rejected" },
    ]);

    const response = await app.inject(withAuth({ method: "GET", url: "/api/reviews/volrep-prm" }));
    const body = response.json();
    expect(body.reviewCount).toBe(1);
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0].author).toBe("Approved One");
  });

  it("orders reviews most-recent-first", async () => {
    const product = await seedProduct();
    const [older] = await db
      .insert(reviews)
      .values({ productId: product.id, author: "Older", rating: 4, body: "First", status: "approved" })
      .returning();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db.insert(reviews).values({ productId: product.id, author: "Newer", rating: 5, body: "Second", status: "approved" });

    const response = await app.inject(withAuth({ method: "GET", url: "/api/reviews/volrep-prm" }));
    const authors = response.json().reviews.map((r: { author: string }) => r.author);
    expect(authors).toEqual(["Newer", "Older"]);
    expect(older).toBeTruthy();
  });

  it("computes the average rating", async () => {
    const product = await seedProduct();
    await db.insert(reviews).values([
      { productId: product.id, author: "A", rating: 5, body: "x", status: "approved" },
      { productId: product.id, author: "B", rating: 3, body: "y", status: "approved" },
    ]);

    const response = await app.inject(withAuth({ method: "GET", url: "/api/reviews/volrep-prm" }));
    expect(response.json().averageRating).toBe(4);
  });

  it("marks a review verified only when it's backed by a real order, never by direct input", async () => {
    const product = await seedProduct();
    const order = await seedPaidOrder("reviewer@example.com");

    await db.insert(reviews).values([
      { productId: product.id, author: "No Order", rating: 5, body: "x", status: "approved" },
      { productId: product.id, orderId: order.id, author: "Real Buyer", rating: 5, body: "y", status: "approved" },
    ]);

    const response = await app.inject(withAuth({ method: "GET", url: "/api/reviews/volrep-prm" }));
    const byAuthor = Object.fromEntries(
      response.json().reviews.map((r: { author: string; verifiedPurchase: boolean }) => [r.author, r.verifiedPurchase]),
    );
    expect(byAuthor).toEqual({ "No Order": false, "Real Buyer": true });
  });

  it("includes review media", async () => {
    const product = await seedProduct();
    const [review] = await db
      .insert(reviews)
      .values({ productId: product.id, author: "Media Author", rating: 5, body: "x", status: "approved" })
      .returning();
    await db.insert(reviewMedia).values({ reviewId: review!.id, url: "https://cdn.example.com/clip.mp4", kind: "video" });

    const response = await app.inject(withAuth({ method: "GET", url: "/api/reviews/volrep-prm" }));
    expect(response.json().reviews[0].media).toEqual([
      { url: "https://cdn.example.com/clip.mp4", altText: null, kind: "video" },
    ]);
  });

  it("never exposes a reviewer's moderation email", async () => {
    const product = await seedProduct();
    await db
      .insert(reviews)
      .values({ productId: product.id, author: "Private", email: "secret@example.com", rating: 5, body: "x", status: "approved" });

    const response = await app.inject(withAuth({ method: "GET", url: "/api/reviews/volrep-prm" }));
    expect(JSON.stringify(response.json())).not.toContain("secret@example.com");
  });
});
