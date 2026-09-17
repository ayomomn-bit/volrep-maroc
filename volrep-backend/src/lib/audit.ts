import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";
import { adminAuditLog } from "../db/schema/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Executor = typeof db | PgTransaction<any, any, any>;

// Entity types recorded in admin_audit_log.entity_type. Kept as a closed
// union so a typo can't silently create an un-queryable audit trail.
export type AuditEntityType =
  | "admin_user"
  | "product"
  | "product_variant"
  | "order"
  | "fulfillment"
  | "review"
  | "shipping_settings"
  | "store_settings"
  | "integration"
  | "landing_page"
  | "homepage"
  | "site_media";

export type AuditEntry = {
  adminUserId: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: Record<string, unknown> | null;
};

// Single writer for admin_audit_log. Every admin mutation calls this —
// pass a transaction handle to make the audit row atomic with the change
// it describes (so a committed mutation always has its audit entry, and a
// rolled-back one leaves none).
//
// NEVER pass a password, session token/cookie, API key, or payment
// credential in `metadata`; callers are responsible for only recording
// safe, business-level detail (before/after values, reasons, ids).
export async function recordAudit(exec: Executor, entry: AuditEntry): Promise<void> {
  await exec.insert(adminAuditLog).values({
    adminUserId: entry.adminUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata ?? null,
  });
}
