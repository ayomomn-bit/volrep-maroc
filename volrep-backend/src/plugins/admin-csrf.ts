import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../lib/errors.js";
import { adminAllowedOrigins } from "../config/env.js";

// CSRF defense for the cookie-authenticated admin surface (security
// hardening — Step 2 §6).
//
// The admin session cookie is SameSite=Strict + HttpOnly + Secure (see
// src/routes/admin/auth.ts), which already blocks classic cross-site form
// and top-level-navigation CSRF. This hook is the defense-in-depth layer
// the brief asks for: on every state-changing /api/admin/* request it
// verifies that, IF the browser told us where the request came from, that
// origin is one we trust.
//
// Design decisions (per the brief's "handle requests without an Origin
// header carefully"):
//   • Only unsafe methods are checked. GET/HEAD/OPTIONS are never mutating
//     and OPTIONS is the CORS preflight.
//   • A present `Origin` that is NOT in the allow-list → 403. This is the
//     case a real browser CSRF attack produces (fetch/XHR/form from
//     evil.com always sends Origin on non-GET requests). A literal
//     `Origin: null` (sandboxed iframe, some redirects) also fails the
//     allow-list check and is rejected.
//   • `Origin` header entirely absent → fall back to the `Referer` origin
//     and apply the same check.
//   • Neither header present → allowed. A browser page cannot make a
//     cross-site request without one of them, so this is not a browser
//     CSRF vector; it covers legitimate non-browser callers (ops scripts,
//     health tooling, the test suite). The SameSite=Strict cookie is the
//     backstop here.
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export async function csrfOriginGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!UNSAFE_METHODS.has(request.method)) return;

  // A present Origin header is authoritative (even the literal "null").
  // Only when it is entirely absent do we consult Referer.
  const claimedOrigin =
    typeof request.headers.origin === "string"
      ? request.headers.origin
      : originOf(request.headers.referer);

  // No browser-supplied provenance at all — not a cross-site browser
  // request. Allowed; the SameSite=Strict cookie is the backstop.
  if (claimedOrigin === null) return;

  if (!adminAllowedOrigins().includes(claimedOrigin)) {
    throw new AppError(403, "CSRF_ORIGIN_REJECTED", "Cross-origin admin request rejected.");
  }
}
