import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../lib/errors.js";
import { ADMIN_SESSION_COOKIE } from "../lib/admin-auth.js";
import { resolveSession, type AdminContext } from "../services/admin/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    // Populated by requireAdmin. Present on every route mounted behind it.
    admin?: AdminContext;
  }
}

// preHandler for every /api/admin/* route except login. Resolves the
// session cookie to an AdminContext or throws 401. This is the ONLY way a
// request becomes "an admin request" — there is no header shortcut, and
// the storefront's x-internal-api-key is not consulted here at all.
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const rawToken = request.cookies?.[ADMIN_SESSION_COOKIE];
  const context = await resolveSession(rawToken);
  if (!context) {
    throw AppError.unauthorized("Admin authentication required");
  }
  request.admin = context;
}

// Second preHandler for OWNER-only routes. Assumes requireAdmin already
// ran (it's always listed after it), so request.admin is set.
export async function requireOwner(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.admin?.role !== "owner") {
    throw AppError.forbidden("This action requires an owner account");
  }
}

// Small helper for handlers: the context is guaranteed present behind
// requireAdmin, but TypeScript only knows it's optional.
export function adminOf(request: FastifyRequest): AdminContext {
  if (!request.admin) throw AppError.unauthorized("Admin authentication required");
  return request.admin;
}
