import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

// The admin auth boundary. This is DELIBERATELY separate from
// src/lib/internal-auth.ts (the storefront's `x-internal-api-key` header):
// that key authorizes the Next.js frontend to read/write carts and place
// orders on a shopper's behalf — it is not, and must never be, an admin
// credential. Admin requests carry a session cookie instead, resolved by
// src/plugins/admin-auth.ts.

// Name of the httpOnly cookie holding the admin session token.
export const ADMIN_SESSION_COOKIE = "volrep_admin_session";

// Admin session tokens are hashed at rest (security hardening — Step 4 M1).
//
//   login            → generateSessionToken() mints a raw token for the
//                      cookie; only hashSessionToken(raw) is written to
//                      admin_sessions.id
//   every request    → cookie raw token → hashSessionToken() → row lookup
//   logout           → same hash → row delete
//
// A DB leak therefore exposes only SHA-256 digests, never a usable bearer
// token. All three call sites (src/services/admin/auth.ts) route through
// these two functions so they cannot drift apart.

// 256 bits of CSPRNG output, hex-encoded (64 chars). Never Math.random,
// never derived from predictable input. This raw value is returned ONLY to
// the browser as the session cookie and is never persisted.
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// One-way hash of a raw session token — the only representation stored in
// the database. SHA-256 without a salt is deliberate and sufficient here:
// the input is 256 bits of uniform random data (not a low-entropy
// password), so it is not brute-forcible, and the digest must be
// deterministic to serve as the primary-key lookup. Output is 64 hex chars.
export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// Shape of a raw session token as it arrives in the cookie. Used to reject
// obvious garbage (or a planted uuid) before any hashing / DB work.
export const SESSION_TOKEN_RE = /^[0-9a-f]{64}$/;

// Path the session cookie is scoped to. Every authenticated surface lives
// under /api/admin/* (routers + /api/admin/auth/*), so the cookie is never
// sent to the storefront routes. `setCookie` and `clearCookie` must use the
// same value or the browser keeps a stale cookie (security hardening — Step 2).
export const ADMIN_SESSION_COOKIE_PATH = "/api/admin";

// Absolute session lifetime — no sliding renewal (schema comment on
// admin_sessions.expiresAt / Architecture §05). Driven by env so it can be
// tuned without a code change; defaults to 12h in config/env.ts.
export function adminSessionTtlMs(): number {
  return env.ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000;
}

// argon2id with library defaults (m=64MiB, t=3, p=4 — verified adequate
// for an admin panel with a handful of users). Never store or compare a
// plaintext password anywhere else.
export function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, { type: argon2.argon2id });
}

// Returns false (never throws) on a malformed/non-argon2 hash so a
// corrupted row can't 500 the login endpoint — it just fails the attempt.
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
