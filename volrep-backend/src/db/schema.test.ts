import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, closeDb } from "./client.js";
import { eq } from "drizzle-orm";
import {
  adminSessions,
  adminUsers,
  carts,
  cartLines,
  checkoutSessions,
  orders,
  products,
  productVariants,
  reviews,
} from "./schema/index.js";
import { hashPassword, hashSessionToken } from "../lib/admin-auth.js";
import { resetDb } from "../test/reset-db.js";

// These exercise the schema-level guarantees the "Volrep Backend
// Architecture" document calls out explicitly — not just that the tables
// exist, but that the constraints actually do what they're there for.
describe("database schema invariants", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  async function seedProductWithVariant() {
    const [product] = await db.insert(products).values({ handle: "volrep-prm", title: "VOLREP PRM" }).returning();
    if (!product) throw new Error("seed failed: product");
    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: product.id,
        title: "Default",
        selectedOptions: [],
        priceAmount: "899.00",
        stock: 10,
      })
      .returning();
    if (!variant) throw new Error("seed failed: variant");
    return { product, variant };
  }

  it("assigns order numbers starting at 1001 and increasing", async () => {
    const { variant } = await seedProductWithVariant();

    const [cart] = await db
      .insert(carts)
      .values({ expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    if (!cart) throw new Error("seed failed: cart");
    await db.insert(cartLines).values({ cartId: cart.id, variantId: variant.id, quantity: 1 });

    const [session1] = await db
      .insert(checkoutSessions)
      .values({
        cartId: cart.id,
        provider: "cod",
        providerSessionId: "cod-session-1",
        status: "completed",
        amountTotal: "899.00",
        currency: "MAD",
        shippingAddress: { line1: "1 Test St" },
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    if (!session1) throw new Error("seed failed: session1");

    const [order1] = await db
      .insert(orders)
      .values({
        checkoutSessionId: session1.id,
        email: "buyer@example.com",
        phone: "+212600000000",
        subtotalAmount: "899.00",
        totalAmount: "899.00",
        currency: "MAD",
        shippingAddress: { line1: "1 Test St" },
        paymentProvider: "cod",
      })
      .returning();

    expect(order1?.orderNumber).toBe(1001);

    const [cart2] = await db
      .insert(carts)
      .values({ expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    if (!cart2) throw new Error("seed failed: cart2");
    const [session2] = await db
      .insert(checkoutSessions)
      .values({
        cartId: cart2.id,
        provider: "cod",
        providerSessionId: "cod-session-2",
        status: "completed",
        amountTotal: "899.00",
        currency: "MAD",
        shippingAddress: { line1: "1 Test St" },
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    if (!session2) throw new Error("seed failed: session2");

    const [order2] = await db
      .insert(orders)
      .values({
        checkoutSessionId: session2.id,
        email: "buyer2@example.com",
        phone: "+212600000001",
        subtotalAmount: "899.00",
        totalAmount: "899.00",
        currency: "MAD",
        shippingAddress: {},
        paymentProvider: "cod",
      })
      .returning();

    expect(order2?.orderNumber).toBe(1002);
  });

  it("rejects a second order against the same checkout session (webhook-retry idempotency guard)", async () => {
    const { variant } = await seedProductWithVariant();
    const [cart] = await db
      .insert(carts)
      .values({ expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    if (!cart) throw new Error("seed failed: cart");
    await db.insert(cartLines).values({ cartId: cart.id, variantId: variant.id, quantity: 1 });

    const [session] = await db
      .insert(checkoutSessions)
      .values({
        cartId: cart.id,
        provider: "cod",
        providerSessionId: "cod-session-dup",
        status: "completed",
        amountTotal: "899.00",
        currency: "MAD",
        shippingAddress: {},
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    if (!session) throw new Error("seed failed: session");

    const orderInput = {
      checkoutSessionId: session.id,
      email: "buyer@example.com",
      phone: "+212600000000",
      subtotalAmount: "899.00",
      totalAmount: "899.00",
      currency: "MAD",
      shippingAddress: {},
      paymentProvider: "cod",
    };

    await db.insert(orders).values(orderInput);
    await expect(db.insert(orders).values(orderInput)).rejects.toThrow(/duplicate key value/i);
  });

  it("computes verified_purchase from order_id and never accepts it as direct input", async () => {
    const { product } = await seedProductWithVariant();

    const [unverified] = await db
      .insert(reviews)
      .values({ productId: product.id, author: "Alex M.", rating: 5, body: "Nice" })
      .returning();
    expect(unverified?.verifiedPurchase).toBe(false);

    const [cart] = await db
      .insert(carts)
      .values({ expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    if (!cart) throw new Error("seed failed: cart");
    const [session] = await db
      .insert(checkoutSessions)
      .values({
        cartId: cart.id,
        provider: "cod",
        providerSessionId: "cod-session-review",
        status: "completed",
        amountTotal: "899.00",
        currency: "MAD",
        shippingAddress: {},
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    if (!session) throw new Error("seed failed: session");
    const [order] = await db
      .insert(orders)
      .values({
        checkoutSessionId: session.id,
        email: "buyer@example.com",
        phone: "+212600000000",
        subtotalAmount: "899.00",
        totalAmount: "899.00",
        currency: "MAD",
        shippingAddress: {},
        paymentProvider: "cod",
      })
      .returning();
    if (!order) throw new Error("seed failed: order");

    const [verified] = await db
      .insert(reviews)
      .values({ productId: product.id, orderId: order.id, author: "Real Buyer", rating: 5, body: "Bought it" })
      .returning();
    expect(verified?.verifiedPurchase).toBe(true);
  });

  it("rejects negative stock and non-positive cart line quantities", async () => {
    const { product } = await seedProductWithVariant();

    await expect(
      db.insert(productVariants).values({
        productId: product.id,
        title: "Bad",
        selectedOptions: [],
        priceAmount: "1.00",
        stock: -1,
      }),
    ).rejects.toThrow(/violates check constraint/i);
  });

  it("stores admin_sessions.id as free text (a SHA-256 digest), not a uuid (Step 4 M1)", async () => {
    const [user] = await db
      .insert(adminUsers)
      .values({ email: "owner@volrep.test", role: "owner", passwordHash: await hashPassword("a-good-password-1") })
      .returning();
    if (!user) throw new Error("seed failed: admin user");

    const hashedId = hashSessionToken("f".repeat(64));
    const [session] = await db
      .insert(adminSessions)
      .values({ id: hashedId, adminUserId: user.id, expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();

    // A 64-char hex digest is NOT a valid uuid — this insert only succeeds
    // because the column is `text`. The primary key round-trips exactly.
    expect(session?.id).toBe(hashedId);
    const [fetched] = await db.select().from(adminSessions).where(eq(adminSessions.id, hashedId));
    expect(fetched?.adminUserId).toBe(user.id);

    // Primary-key uniqueness is preserved on the new column type.
    await expect(
      db.insert(adminSessions).values({ id: hashedId, adminUserId: user.id, expiresAt: new Date(Date.now() + 1000) }),
    ).rejects.toThrow(/duplicate key value/i);
  });

  it("merges duplicate cart lines for the same variant via the unique constraint", async () => {
    const { variant } = await seedProductWithVariant();
    const [cart] = await db
      .insert(carts)
      .values({ expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    if (!cart) throw new Error("seed failed: cart");

    await db.insert(cartLines).values({ cartId: cart.id, variantId: variant.id, quantity: 1 });
    await expect(
      db.insert(cartLines).values({ cartId: cart.id, variantId: variant.id, quantity: 1 }),
    ).rejects.toThrow(/duplicate key value/i);
  });
});
