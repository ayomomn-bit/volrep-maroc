import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

// Constant-time comparison of the caller-supplied `x-internal-api-key`
// against the configured secret (security hardening — Step 4 L1).
//
// A plain `===` / `!==` on the raw strings short-circuits at the first
// differing byte, so response time leaks how long a correct prefix the
// caller guessed — a classic timing side-channel against a bearer
// credential. We HMAC both sides under a fresh random key first, so
// `timingSafeEqual` always compares two equal-length (32-byte) digests:
// no length-based branch to leak the secret's length, and the compare
// cost is independent of the input. Non-string headers (absent, or the
// `string[]` form) can never match — same outcome as the old `!==`.
function internalKeyMatches(provided: unknown): boolean {
  if (typeof provided !== "string") return false;
  const key = randomBytes(32);
  const a = createHmac("sha256", key).update(provided).digest();
  const b = createHmac("sha256", key).update(env.INTERNAL_API_KEY).digest();
  return timingSafeEqual(a, b);
}

// Storefront routes are called server-to-server by the Next.js frontend,
// never directly from a browser (Architecture §01/§14) — this header is
// the one credential guarding that boundary. Order tracking and reviews
// are also gated by it even though they're "public data" in spirit,
// because the frontend is still the only intended caller in this phase.
export async function requireInternalApiKey(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!internalKeyMatches(request.headers["x-internal-api-key"])) {
    throw AppError.unauthorized("Missing or invalid internal API key");
  }
}

// True when a request carries the correct internal API key — i.e. it is a
// server-to-server call from our own Next.js frontend, not browser or
// direct traffic. Used ONLY to exempt that trusted caller from the GLOBAL
// rate limiter (src/app.ts): without this, every storefront request shares
// one bucket keyed on the single Next server IP (security hardening —
// Step 4 H1). This does NOT authorize anything on its own — the storefront
// routes still run `requireInternalApiKey` as their preHandler — and the
// per-route abuse limiters (login, COD, order tracking) opt out of this
// allow-list with `allowList: []` so they stay effective for this caller.
export function isTrustedInternalRequest(request: FastifyRequest): boolean {
  return internalKeyMatches(request.headers["x-internal-api-key"]);
}
