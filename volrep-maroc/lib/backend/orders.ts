import { backendFetch, BackendError } from "@/lib/backend/client";
import { clientForwardedFor } from "@/lib/backend/request-ip";

// Same shapes as the retired lib/shopify/orders.ts — the backend's
// GET /api/orders/track (volrep-backend's src/mappers/order.ts) already
// returns { status: "found", order: {...} } | { status: "not_found" }
// matching this exactly; only the third "error" case is added here, for
// the transport-level failures (rate limited, malformed input, server
// error) the backend expresses as HTTP status codes rather than a body.

export type OrderTrackingFulfillment = {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type OrderTrackingInfo = {
  name: string;
  status: string;
  lineItems: { title: string; quantity: number }[];
  fulfillment: OrderTrackingFulfillment | null;
};

export type TrackOrderResult =
  | { status: "found"; order: OrderTrackingInfo }
  | { status: "not_found" }
  | { status: "error" };

export async function findOrderForTracking(orderNumber: string, email: string): Promise<TrackOrderResult> {
  try {
    return await backendFetch<TrackOrderResult>("/api/orders/track", {
      query: { orderNumber, email },
      cache: "no-store",
      // Forward the real customer IP so the backend's per-route brute-force
      // limiter (8 / 10 min) keys on the actual visitor rather than on this
      // server's single outbound address — exactly like the COD path
      // (security hardening — Step 4 H2). Read from the hop in front of
      // Next.js (Nginx/Caddy X-Forwarded-For / X-Real-IP); the backend only
      // trusts it because this is an internal-key server-to-server call from
      // a loopback peer, and it re-derives request.ip via its trust-proxy
      // allow-list (Step 1).
      forwardedFor: await clientForwardedFor(),
    });
  } catch (error) {
    if (error instanceof BackendError && error.status === 400) {
      // Malformed input that somehow got past this app's own
      // client-side validation — treated the same as "no match" rather
      // than surfaced as a system error.
      return { status: "not_found" };
    }
    // Covers a 429 (rate limited) and any 5xx alike — the UI shows the
    // same generic "something went wrong" message either way.
    console.error("Volrep backend findOrderForTracking error:", error);
    return { status: "error" };
  }
}
