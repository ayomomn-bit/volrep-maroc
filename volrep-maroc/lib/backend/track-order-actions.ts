"use server";

import { findOrderForTracking, type TrackOrderResult } from "@/lib/backend/orders";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Our own order numbers are a plain integer sequence (matches the
// backend's Zod schema in volrep-backend's src/routes/orders.ts) — no
// longer the broader alphanumeric pattern Shopify's order "names" allowed.
const ORDER_NUMBER_PATTERN = /^#?[0-9]{1,10}$/;

// Server Actions are POST endpoints reachable by anyone who can send the
// request, not just this page's form — re-validate here even though the
// client already checks the same patterns before submitting. The
// in-memory per-IP limiter that used to live here is gone: the backend's
// own rate limit (Architecture §14) is the real brute-force guard now,
// enforced by the framework rather than a Map that reset on every
// redeploy.
export async function trackOrderAction(input: { orderNumber: string; email: string }): Promise<TrackOrderResult> {
  const orderNumber = input.orderNumber.trim();
  const email = input.email.trim();

  if (!ORDER_NUMBER_PATTERN.test(orderNumber) || !EMAIL_PATTERN.test(email)) {
    return { status: "not_found" };
  }

  return findOrderForTracking(orderNumber, email);
}
