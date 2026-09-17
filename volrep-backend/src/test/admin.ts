import type { FastifyInstance, InjectOptions } from "fastify";
import { db } from "../db/client.js";
import {
  adminUsers,
  carts,
  checkoutSessions,
  orderLineItems,
  orders,
  productVariants,
  products,
} from "../db/schema/index.js";
import { hashPassword, ADMIN_SESSION_COOKIE } from "../lib/admin-auth.js";

export const ADMIN_DEFAULT_PASSWORD = "correct horse battery staple 7";

type AdminRole = "owner" | "staff";

// Inserts an admin_users row with a real argon2id hash. Email defaults to
// a role-derived address so a test can seed one owner + one staff without
// colliding on the unique email constraint.
export async function seedAdmin(
  overrides: { email?: string; role?: AdminRole; password?: string } = {},
): Promise<{ id: string; email: string; role: AdminRole; password: string }> {
  const role: AdminRole = overrides.role ?? "owner";
  const email = (overrides.email ?? `${role}@volrep.test`).toLowerCase();
  const password = overrides.password ?? ADMIN_DEFAULT_PASSWORD;

  const [row] = await db
    .insert(adminUsers)
    .values({ email, role, passwordHash: await hashPassword(password) })
    .returning({ id: adminUsers.id });
  if (!row) throw new Error("seedAdmin failed");
  return { id: row.id, email, role, password };
}

// Logs in through the real route and returns the session id from the
// Set-Cookie header, so tests exercise the same path a browser would.
export async function loginAdmin(app: FastifyInstance, email: string, password = ADMIN_DEFAULT_PASSWORD): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`loginAdmin failed (${res.statusCode}): ${res.body}`);
  }
  const cookies = res.cookies as { name: string; value: string }[];
  const session = cookies.find((c) => c.name === ADMIN_SESSION_COOKIE);
  if (!session) throw new Error("loginAdmin: no session cookie set");
  return session.value;
}

// Seed an admin AND log in, in one call — the common test setup.
export async function seedAndLoginAdmin(
  app: FastifyInstance,
  overrides: { email?: string; role?: AdminRole; password?: string } = {},
): Promise<{ id: string; email: string; role: AdminRole; sessionId: string }> {
  const admin = await seedAdmin(overrides);
  const sessionId = await loginAdmin(app, admin.email, admin.password);
  return { id: admin.id, email: admin.email, role: admin.role, sessionId };
}

// Attach an admin session cookie to an inject() call.
export function asAdmin(sessionId: string, options: InjectOptions): InjectOptions {
  return { ...options, cookies: { ...(options.cookies ?? {}), [ADMIN_SESSION_COOKIE]: sessionId } };
}

// Inserts a complete placed order (product + variant + cart +
// checkout_session + order + one line item) straight into the DB, the
// same shape src/services/checkout.ts produces. Returns the ids the admin
// order tests need.
export async function seedOrder(
  overrides: {
    email?: string;
    phone?: string;
    status?: "pending_payment" | "paid" | "fulfilled" | "partially_fulfilled" | "canceled" | "refunded" | "partially_refunded";
    quantity?: number;
    unitPrice?: string;
    productTitle?: string;
  } = {},
): Promise<{ orderId: string; orderNumber: number; variantId: string; productId: string; email: string }> {
  const email = (overrides.email ?? "buyer@example.test").toLowerCase();
  const quantity = overrides.quantity ?? 1;
  const unitPrice = overrides.unitPrice ?? "899.00";
  const lineTotal = (Number(unitPrice) * quantity).toFixed(2);

  const [product] = await db
    .insert(products)
    .values({ handle: `order-prod-${crypto.randomUUID()}`, title: overrides.productTitle ?? "Test Product", status: "active" })
    .returning();
  const [variant] = await db
    .insert(productVariants)
    .values({ productId: product!.id, title: "Default", selectedOptions: [], priceAmount: unitPrice, stock: 50 })
    .returning();
  const [cart] = await db
    .insert(carts)
    .values({ status: "converted", expiresAt: new Date(Date.now() + 86_400_000) })
    .returning();
  const [session] = await db
    .insert(checkoutSessions)
    .values({
      cartId: cart!.id,
      provider: "cod",
      providerSessionId: crypto.randomUUID(),
      status: "completed",
      amountTotal: lineTotal,
      currency: "MAD",
      customerEmail: email,
      shippingAddress: { line1: "1 Test St", city: "Casablanca", country: "MA" },
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  const [order] = await db
    .insert(orders)
    .values({
      checkoutSessionId: session!.id,
      email,
      phone: overrides.phone ?? "+212600000000",
      status: overrides.status ?? "pending_payment",
      subtotalAmount: lineTotal,
      shippingAmount: "0",
      totalAmount: lineTotal,
      currency: "MAD",
      shippingAddress: { line1: "1 Test St", city: "Casablanca", country: "MA" },
      paymentProvider: "cod",
    })
    .returning();
  await db.insert(orderLineItems).values({
    orderId: order!.id,
    variantId: variant!.id,
    productTitle: overrides.productTitle ?? "Test Product",
    variantTitle: "Default",
    sku: null,
    quantity,
    unitPriceAmount: unitPrice,
    lineTotalAmount: lineTotal,
  });

  return { orderId: order!.id, orderNumber: order!.orderNumber, variantId: variant!.id, productId: product!.id, email };
}
