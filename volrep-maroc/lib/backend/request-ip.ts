import "server-only";

import { headers } from "next/headers";

// The real client IP for the in-flight request, read from the hop directly
// in front of the Next.js server (Nginx/Caddy sets X-Forwarded-For /
// X-Real-IP). Forwarded to the Volrep backend on Cash-on-Delivery order
// calls so its per-IP abuse guard keys on the actual shopper rather than on
// this server's single outbound address.
//
// Returns null when no forwarding header is present (e.g. a direct hit in
// local dev) — the backend then falls back to the socket address, which is
// the safe default.
export async function clientForwardedFor(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? null;
}
