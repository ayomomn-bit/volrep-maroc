import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { AppError } from "../lib/errors.js";
import {
  carts,
  cartLines,
  checkoutSessions,
  orderLineItems,
  orders,
  productVariants,
  products,
  shippingSettings,
} from "../db/schema/index.js";
import { mapOrder, type ApiOrder } from "../mappers/order.js";

export type ShippingAddressInput = {
  line1: string;
  // `| undefined` (not just `?`) because Zod's `.optional()` produces a
  // value type that includes undefined, not merely an omittable key —
  // exactOptionalPropertyTypes treats those as different declarations.
  line2?: string | undefined;
  city: string;
  country: string;
  postalCode?: string | undefined;
};

export type CreateCodOrderInput = {
  cartId: string;
  email: string;
  phone: string;
  shippingAddress: ShippingAddressInput;
};

// V1 is Cash on Delivery only. No payment-provider SDK, API call, or
// webhook exists anywhere in this function — `checkout_sessions` is our
// own bookkeeping table, not a third-party record. It's created and
// completed synchronously in the same request specifically so a future
// card provider (async: pending -> webhook -> completed) slots into this
// exact same table and the same orders/order_line_items schema without a
// rewrite (Phase 3 decision, carried forward here).
export async function createCodOrder(input: CreateCodOrderInput): Promise<ApiOrder> {
  const countryCode = input.shippingAddress.country.toUpperCase();

  return db.transaction(async (tx) => {
    // Lock the cart row so a concurrent second checkout attempt against
    // the same cart blocks until this one finishes, then sees the
    // 'converted' status below rather than racing it.
    const [cart] = await tx.select().from(carts).where(eq(carts.id, input.cartId)).for("update");
    if (!cart) throw AppError.notFound("Cart not found");

    if (cart.status !== "active" || cart.expiresAt <= new Date()) {
      // This is the duplicate-submission guard: a cart is single-use.
      // The first successful checkout marks it 'converted' below, so a
      // resubmission (double-click, retry) lands here instead of
      // creating a second order.
      throw new AppError(409, "CART_NOT_ACTIVE", "This cart is no longer active. Start a new cart to check out.");
    }

    const lineRows = await tx
      .select({
        lineId: cartLines.id,
        quantity: cartLines.quantity,
        variantId: productVariants.id,
        variantTitle: productVariants.title,
        sku: productVariants.sku,
        priceAmount: productVariants.priceAmount,
        priceCurrency: productVariants.priceCurrency,
        stock: productVariants.stock,
        availableForSale: productVariants.availableForSale,
        productTitle: products.title,
      })
      .from(cartLines)
      .innerJoin(productVariants, eq(cartLines.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(cartLines.cartId, cart.id))
      .for("update");

    if (lineRows.length === 0) {
      throw AppError.badRequest("Your cart is empty.");
    }

    for (const line of lineRows) {
      if (!line.availableForSale || line.stock < line.quantity) {
        throw AppError.conflict(
          "OUT_OF_STOCK",
          `"${line.productTitle} — ${line.variantTitle}" no longer has enough stock.`,
          { variantId: line.variantId },
        );
      }
    }

    const currency = lineRows[0]!.priceCurrency;
    const subtotalAmount = lineRows.reduce((sum, line) => sum + Number(line.priceAmount) * line.quantity, 0);

    const [shipping] = await tx
      .select()
      .from(shippingSettings)
      .where(and(eq(shippingSettings.countryCode, countryCode), eq(shippingSettings.active, true)))
      .limit(1);

    if (!shipping) {
      throw new AppError(400, "SHIPPING_UNAVAILABLE", `Shipping is not currently available to ${countryCode}.`);
    }

    const shippingAmount = Number(shipping.flatRateAmount);
    const totalAmount = subtotalAmount + shippingAmount;

    const [session] = await tx
      .insert(checkoutSessions)
      .values({
        cartId: cart.id,
        provider: "cod",
        providerSessionId: crypto.randomUUID(),
        status: "completed",
        amountTotal: totalAmount.toFixed(2),
        currency,
        customerEmail: input.email,
        customerPhone: input.phone,
        shippingAddress: input.shippingAddress,
        // COD has no external session lifetime — this just satisfies the
        // NOT NULL column shared with a future async provider's sessions.
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();
    if (!session) throw new Error("Failed to create checkout session");

    const [order] = await tx
      .insert(orders)
      .values({
        checkoutSessionId: session.id,
        email: input.email,
        phone: input.phone,
        subtotalAmount: subtotalAmount.toFixed(2),
        shippingAmount: shippingAmount.toFixed(2),
        discountAmount: "0",
        totalAmount: totalAmount.toFixed(2),
        currency,
        shippingAddress: input.shippingAddress,
        paymentProvider: "cod",
        paymentReference: null,
        // status defaults to 'pending_payment' — COD orders only reach
        // 'paid' via an explicit admin action once cash is collected on
        // delivery (Architecture §08); there is no webhook to do it here.
      })
      .returning();
    if (!order) throw new Error("Failed to create order");

    for (const line of lineRows) {
      const lineTotalAmount = Number(line.priceAmount) * line.quantity;

      await tx.insert(orderLineItems).values({
        orderId: order.id,
        variantId: line.variantId,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sku: line.sku,
        quantity: line.quantity,
        unitPriceAmount: line.priceAmount,
        lineTotalAmount: lineTotalAmount.toFixed(2),
      });

      // Re-checked with a WHERE guard even though the row was already
      // locked and validated above — belt-and-suspenders against ever
      // decrementing stock past zero.
      const decremented = await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${line.quantity}`, updatedAt: new Date() })
        .where(and(eq(productVariants.id, line.variantId), gte(productVariants.stock, line.quantity)))
        .returning({ id: productVariants.id });

      if (decremented.length === 0) {
        throw AppError.conflict("OUT_OF_STOCK", "Stock changed while your order was being placed. Please try again.");
      }
    }

    await tx.update(carts).set({ status: "converted", updatedAt: new Date() }).where(eq(carts.id, cart.id));

    return mapOrder(order);
  });
}
