import type { FastifyInstance } from "fastify";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../../plugins/admin-auth.js";
import { db } from "../../db/client.js";
import { adminAuditLog, adminUsers } from "../../db/schema/index.js";
import { mapAuditEntry } from "../../mappers/admin.js";

const querySchema = z
  .object({
    entityType: z
      .enum(["admin_user", "product", "product_variant", "order", "fulfillment", "review", "shipping_settings"])
      .optional(),
    entityId: z.string().uuid().optional(),
    adminUserId: z.string().uuid().optional(),
    action: z.string().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

// Read-only. The audit log is append-only by design — there is no
// endpoint anywhere that updates or deletes a row here.
export async function adminAuditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/audit-log", async (request) => {
    const q = querySchema.parse(request.query);
    const conditions = [];
    if (q.entityType) conditions.push(eq(adminAuditLog.entityType, q.entityType));
    if (q.entityId) conditions.push(eq(adminAuditLog.entityId, q.entityId));
    if (q.adminUserId) conditions.push(eq(adminAuditLog.adminUserId, q.adminUserId));
    if (q.action) conditions.push(eq(adminAuditLog.action, q.action));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({ entry: adminAuditLog, adminEmail: adminUsers.email })
        .from(adminAuditLog)
        .leftJoin(adminUsers, eq(adminAuditLog.adminUserId, adminUsers.id))
        .where(where)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(q.limit)
        .offset(q.offset),
      db.select({ value: count() }).from(adminAuditLog).where(where),
    ]);

    return {
      entries: rows.map((r) => mapAuditEntry(r.entry, r.adminEmail)),
      total: totalRow?.value ?? 0,
      limit: q.limit,
      offset: q.offset,
    };
  });
}
