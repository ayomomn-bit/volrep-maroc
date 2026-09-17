import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_COOKIE_PATH, adminSessionTtlMs } from "../../lib/admin-auth.js";
import { requireAdmin } from "../../plugins/admin-auth.js";
import { createAdminLoginThrottle, login, logout } from "../../services/admin/auth.js";
import { db } from "../../db/client.js";
import { adminUsers } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { mapAdminUser } from "../../mappers/admin.js";

const loginBodySchema = z
  .object({
    email: z.string().email().max(320),
    // Min 12 — consistent with the create-admin CLI policy (src/db/create-admin.ts).
    // No composition rules (the repo has none); the generic auth error is
    // preserved and a too-short password is a plain 400 VALIDATION_ERROR,
    // never an account-existence signal (security hardening — Step 4 M2).
    password: z.string().min(12).max(200),
  })
  .strict();

function sessionCookieOptions() {
  return {
    httpOnly: true,
    // HTTPS-only in production; left off for localhost HTTP dev so login
    // keeps working without a TLS cert.
    secure: env.NODE_ENV === "production",
    // Strict: the admin SPA authenticates by same-site XHR to the API
    // (admin.volrep.com → api.volrep.com share the volrep.com registrable
    // domain, so those requests are same-site and the cookie still rides
    // along), and there is no cross-site top-level flow into the admin that
    // needs the cookie. Strict blocks it on every cross-site request,
    // including form POSTs — the primary CSRF defense (Step 2).
    sameSite: "strict" as const,
    path: ADMIN_SESSION_COOKIE_PATH,
    maxAge: Math.floor(adminSessionTtlMs() / 1000),
  };
}

export async function adminAuthRoutes(app: FastifyInstance): Promise<void> {
  // Per-account failed-login throttle — one instance per app (mirrors the
  // COD phone guard). Additional to the per-IP route limiter below, never a
  // replacement. See src/services/admin/auth.ts for the design.
  const accountThrottle = createAdminLoginThrottle();

  app.post(
    "/api/admin/auth/login",
    {
      // Brute-force guard, per source IP, well below the global 100/min
      // baseline. 10/15min stops automated guessing cold (argon2id verify
      // is deliberately slow on top of this) while leaving a human admin
      // room for a few fat-fingered attempts before a short lockout.
      //
      // `allowList: []` is defensive: the admin login never carries the
      // storefront's internal API key, so the global limiter's internal-key
      // allow-list (src/app.ts, Step 4 H1) would not exempt it anyway — but
      // pinning it here means this guard can never inherit that behaviour.
      config: { rateLimit: { max: 10, timeWindow: "15 minutes", allowList: [] } },
    },
    async (request, reply) => {
      const { email, password } = loginBodySchema.parse(request.body);

      const { token, context } = await login(
        {
          email,
          password,
          ip: request.ip ?? null,
          userAgent: request.headers["user-agent"] ?? null,
        },
        accountThrottle,
      );

      // `token` is the raw high-entropy session token; only its SHA-256
      // hash is stored in the DB (security hardening — Step 4 M1). Cookie
      // flags (httpOnly / SameSite=Strict / path / Secure-in-prod) unchanged.
      reply.setCookie(ADMIN_SESSION_COOKIE, token, sessionCookieOptions());
      reply.status(200);
      return { admin: { id: context.userId, email: context.email, role: context.role } };
    },
  );

  app.post("/api/admin/auth/logout", { preHandler: requireAdmin }, async (request, reply) => {
    await logout(request.admin!);
    reply.clearCookie(ADMIN_SESSION_COOKIE, { path: ADMIN_SESSION_COOKIE_PATH });
    return { ok: true };
  });

  app.get("/api/admin/auth/me", { preHandler: requireAdmin }, async (request) => {
    const [row] = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        lastLoginAt: adminUsers.lastLoginAt,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, request.admin!.userId))
      .limit(1);

    // The session resolved, so the row exists; this is just for the shape.
    return { admin: row ? mapAdminUser(row) : null };
  });
}
