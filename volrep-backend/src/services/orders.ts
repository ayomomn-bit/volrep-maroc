import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { fulfillments, orderLineItems, orders } from "../db/schema/index.js";
import { formatOrderNumber, humanizeStatus, type ApiTrackOrderResult } from "../mappers/order.js";

// Order number + email is what the UI collects, but the number alone is
// sequential/guessable — the email match below (not the number lookup)
// is the actual access control. A caller who gets the number right but
// the email wrong must see exactly the same "not_found" result as a
// caller who guessed a number that doesn't exist at all, so this can
// never become an oracle for "does order #1002 exist" (carried forward
// verbatim from the original lib/shopify/orders.ts invariant).
export async function trackOrder(orderNumberRaw: string, email: string): Promise<ApiTrackOrderResult> {
  const numeric = Number(orderNumberRaw.replace(/^#/, ""));

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, numeric)).limit(1);

  if (!order || order.email.toLowerCase() !== email.trim().toLowerCase()) {
    return { status: "not_found" };
  }

  const lineItems = await db
    .select({ title: orderLineItems.productTitle, quantity: orderLineItems.quantity })
    .from(orderLineItems)
    .where(eq(orderLineItems.orderId, order.id));

  const [fulfillment] = await db.select().from(fulfillments).where(eq(fulfillments.orderId, order.id)).limit(1);

  return {
    status: "found",
    order: {
      name: formatOrderNumber(order.orderNumber),
      status: humanizeStatus(order.status),
      lineItems,
      // null means "nothing has shipped yet" — the UI shows a
      // not-available-yet message rather than an empty tracking section
      // (Architecture §04, OrderResultCard.tsx's existing contract).
      fulfillment:
        fulfillment && fulfillment.status === "fulfilled"
          ? { carrier: fulfillment.carrier, trackingNumber: fulfillment.trackingNumber, trackingUrl: fulfillment.trackingUrl }
          : null,
    },
  };
}
