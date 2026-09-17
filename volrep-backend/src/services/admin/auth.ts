import { eq, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { adminSessions, adminUsers } from "../../db/schema/index.js";
import {
  adminSessionTtlMs,
  generateSessionToken,
  hashSessionToken,
  SESSION_TOKEN_RE,
  verifyPassword,
} from "../../lib/admin-auth.js";
import { SlidingWindowCounter } from "../../lib/abuse-guard.js";
import { recordAudit } from "../../lib/audit.js";

export type AdminRole = "owner" | "staff";

// The authenticated principal attached to a request by requireAdmin.
// Never carries the password hash or the raw session token. `sessionId` is
// the HASHED session id — i.e. the admin_sessions primary key, never the
// bearer token from the cookie (security hardening — Step 4 M1).
export type AdminContext = {
  sessionId: string;
  userId: string;
  email: string;
  role: AdminRole;
};

export type LoginInput = {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
};

// One deliberately vague message for every failure mode (unknown email,
// wrong password, disabled account, throttled account). Login must never be
// an oracle for "does this email have an account" or "is it locked" (§14).
const INVALID_CREDENTIALS = "Invalid email or password.";

// Per-account failed-login throttle (security hardening — Step 4 M2).
//
// Keyed by the NORMALIZED admin email, so it caps password guesses against
// one account across ALL source IPs — something the per-IP
// @fastify/rate-limit route limiter (10 / 15min, unchanged) cannot do. It
// runs IN ADDITION to that IP limiter, never instead of it.
//
//   • ADMIN_ACCOUNT_LOGIN_MAX_FAILURES failures within
//     ADMIN_ACCOUNT_LOGIN_WINDOW_MINUTES → the account is throttled
//   • the window is self-healing: the block lifts as the oldest recorded
//     failure ages out, so it is TEMPORARY, never a permanent lockout an
//     attacker could weaponise, and continued hammering does not extend it
//   • a correct password on an UNLOCKED account authenticates and clears
//     the state (a brute-forcer never reaches this — they lack the password)
//   • the key map is bounded (LOGIN_GUARD_MAX_KEYS) with LRU eviction, so
//     hammering many junk emails cannot exhaust process memory
//   • a throttled attempt returns the SAME generic 401 as any wrong
//     password, and throttling applies identically whether or not the email
//     maps to a real account — it is not a new "exists / is locked" oracle
//
// One instance per Fastify app (created by adminAuthRoutes, mirroring the
// COD phone guard in src/routes/checkout.ts) so tests are isolated.
const LOGIN_GUARD_MAX_KEYS = 4096;

export function createAdminLoginThrottle(): SlidingWindowCounter {
  return new SlidingWindowCounter(
    env.ADMIN_ACCOUNT_LOGIN_MAX_FAILURES,
    env.ADMIN_ACCOUNT_LOGIN_WINDOW_MINUTES * 60_000,
    LOGIN_GUARD_MAX_KEYS,
  );
}

export async function login(
  input: LoginInput,
  throttle: SlidingWindowCounter,
): Promise<{ token: string; context: AdminContext }> {
  const email = input.email.trim().toLowerCase();

  // Account-level throttle: once this email has accumulated too many recent
  // failures (across every source IP), reject fast with the SAME generic
  // error — no DB lookup, no password verify. Applies identically whether
  // or not the account exists, so "fast response" only ever means "this
  // email string has N recent failures", never "this account exists".
  if (throttle.peek(email).limited) {
    throw new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
  }

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);

  // Always run a verify, even with no user, so response timing doesn't
  // distinguish "no such account" from "wrong password". The dummy hash
  // is a real argon2id hash of a random string.
  const hashToCheck =
    user?.passwordHash ??
    "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG";
  const passwordOk = await verifyPassword(hashToCheck, input.password);

  if (!user || !passwordOk) {
    // Count the failure against the account key (real email or not).
    throttle.hit(email);
    throw new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
  }

  // Success → this account's failure state is reset.
  throttle.clear(email);

  const expiresAt = new Date(Date.now() + adminSessionTtlMs());

  // Mint the raw bearer token for the browser; persist ONLY its hash as the
  // session's primary key. The raw token never touches the database.
  const token = generateSessionToken();
  const hashedId = hashSessionToken(token);

  await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(adminSessions)
      .values({ id: hashedId, adminUserId: user.id, ip: input.ip, userAgent: input.userAgent, expiresAt })
      .returning({ id: adminSessions.id });
    if (!session) throw new Error("Failed to create admin session");

    await tx.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));

    await recordAudit(tx, {
      adminUserId: user.id,
      action: "admin.login",
      entityType: "admin_user",
      entityId: user.id,
      metadata: { ip: input.ip, userAgent: input.userAgent },
    });
  });

  return {
    token,
    context: { sessionId: hashedId, userId: user.id, email: user.email, role: user.role },
  };
}

// Resolves a raw session cookie token to an AdminContext, or null for a
// missing / malformed / unknown / expired session. The lookup is by
// hashSessionToken(rawToken) — the stored hash, never the raw token — so a
// leaked admin_sessions.id can't be replayed as a cookie. Also
// opportunistically deletes the row when it's found but expired, so stale
// sessions don't accumulate.
export async function resolveSession(rawToken: string | undefined): Promise<AdminContext | null> {
  if (!rawToken || !SESSION_TOKEN_RE.test(rawToken)) return null;

  const hashedId = hashSessionToken(rawToken);

  const [row] = await db
    .select({
      sessionId: adminSessions.id,
      expiresAt: adminSessions.expiresAt,
      userId: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(eq(adminSessions.id, hashedId))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt <= new Date()) {
    await db.delete(adminSessions).where(eq(adminSessions.id, hashedId));
    return null;
  }

  return { sessionId: row.sessionId, userId: row.userId, email: row.email, role: row.role };
}

export async function logout(context: AdminContext): Promise<void> {
  await db.transaction(async (tx) => {
    // context.sessionId is the hashed id (set by resolveSession from the
    // raw cookie token via hashSessionToken), so this deletes the right row
    // without the raw token ever being needed again.
    await tx.delete(adminSessions).where(eq(adminSessions.id, context.sessionId));
    await recordAudit(tx, {
      adminUserId: context.userId,
      action: "admin.logout",
      entityType: "admin_user",
      entityId: context.userId,
      metadata: null,
    });
  });
}

// Housekeeping — not wired to a scheduler in V1, but callable so a future
// cron/route can prune expired session rows. Kept next to the code that
// creates sessions so the lifecycle is visible in one place.
export async function purgeExpiredSessions(): Promise<number> {
  const deleted = await db
    .delete(adminSessions)
    .where(lte(adminSessions.expiresAt, new Date()))
    .returning({ id: adminSessions.id });
  return deleted.length;
}
