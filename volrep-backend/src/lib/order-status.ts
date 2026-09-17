// The one authoritative order-status state machine, in a dependency-free
// module so both the service (which enforces it) and the mapper (which
// advertises the allowed next states to the admin UI) can use it without a
// circular import.
//
// Built over the EXISTING `order_status` enum (src/db/schema/enums.ts) — no
// new statuses were invented. Terminal states (canceled, refunded) have no
// outgoing edges.

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "fulfilled"
  | "partially_fulfilled"
  | "canceled"
  | "refunded"
  | "partially_refunded";

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "canceled"],
  paid: ["fulfilled", "partially_fulfilled", "refunded"],
  partially_fulfilled: ["fulfilled", "partially_refunded", "refunded"],
  fulfilled: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
  canceled: [],
  refunded: [],
};

export function allowedTransitionsFor(status: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[status] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedTransitionsFor(from).includes(to);
}
