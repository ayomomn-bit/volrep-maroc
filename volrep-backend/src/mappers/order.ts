import { toMoney, type Money } from "../lib/money.js";
import type { orders } from "../db/schema/index.js";

type OrderRow = typeof orders.$inferSelect;

export type ApiOrder = {
  id: string;
  orderNumber: string;
  status: string;
  email: string;
  phone: string;
  subtotalAmount: Money;
  shippingAmount: Money;
  totalAmount: Money;
  currency: string;
  shippingAddress: unknown;
  paymentProvider: string;
  createdAt: string;
};

// "#1001" — matches TrackOrderForm's existing placeholder/validation
// pattern exactly (Architecture §03), so the frontend's tracking form
// doesn't need to change to accept this.
export function formatOrderNumber(orderNumber: number): string {
  return `#${orderNumber}`;
}

// "pending_payment" -> "Pending Payment" — generic so it doesn't need
// updating if a new order_status value is added later. Same recipe as the
// original Shopify-era toDisplayStatus() this replaces.
export function humanizeStatus(status: string): string {
  return status
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

// Customer-safe tracking shapes only — no internal database id, no
// customer email/phone/address, no payment reference, no admin/audit
// data. This is deliberately a narrower projection than ApiOrder above.
export type ApiOrderTrackingFulfillment = {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type ApiOrderTrackingInfo = {
  name: string;
  status: string;
  lineItems: { title: string; quantity: number }[];
  fulfillment: ApiOrderTrackingFulfillment | null;
};

export type ApiTrackOrderResult =
  | { status: "found"; order: ApiOrderTrackingInfo }
  | { status: "not_found" };

export function mapOrder(order: OrderRow): ApiOrder {
  return {
    id: order.id,
    orderNumber: formatOrderNumber(order.orderNumber),
    status: order.status,
    email: order.email,
    phone: order.phone,
    subtotalAmount: toMoney(order.subtotalAmount, order.currency),
    shippingAmount: toMoney(order.shippingAmount, order.currency),
    totalAmount: toMoney(order.totalAmount, order.currency),
    currency: order.currency,
    shippingAddress: order.shippingAddress,
    paymentProvider: order.paymentProvider,
    createdAt: order.createdAt.toISOString(),
  };
}
