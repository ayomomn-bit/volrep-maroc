import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

// Unauthenticated readiness probe for the reverse proxy / uptime monitor.
// It still verifies DB reachability (a `select 1` round-trip), but the
// RESPONSE BODY is deliberately minimal — just `{ status }` and the
// 200 / 503 code the orchestrator keys on. It must never disclose
// infrastructure detail (which dependency is down, driver/version, error
// text) to an unauthenticated caller (security hardening — Step 4 L4).
// The real failure reason is still logged server-side (L2-redacted).
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
    } catch (error) {
      app.log.error({ err: error }, "Health check: database unreachable");
      reply.status(503);
      return { status: "error" };
    }

    return { status: "ok" };
  });
}
