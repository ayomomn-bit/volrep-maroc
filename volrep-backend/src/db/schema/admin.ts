import { index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { adminRole } from "./enums.js";

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    // argon2id (Architecture §00/§14) — never a plaintext or reversibly
    // encrypted password.
    passwordHash: text("password_hash").notNull(),
    role: adminRole("role").notNull().default("staff"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: unique("admin_users_email_unique").on(table.email),
  }),
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    // NOT the bearer token. This is SHA-256(rawToken) — a one-way hash of
    // the high-entropy token that actually lives in the admin's httpOnly
    // cookie (security hardening — Step 4 M1). The raw token is never
    // persisted, so a DB leak yields no usable session. `text`, not
    // `uuid`, because it holds a 64-char hex digest; generated in the app
    // (src/lib/admin-auth.ts), so no DB-side default.
    id: text("id").primaryKey(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // 12-hour absolute expiry, no sliding renewal (Architecture §05).
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    adminUserIdx: index("admin_sessions_admin_user_id_idx").on(table.adminUserId),
    expiresAtIdx: index("admin_sessions_expires_at_idx").on(table.expiresAt),
  }),
);

// Written by one shared Fastify hook wrapping every mutating
// /api/admin/* route — not re-implemented per endpoint (Architecture §03).
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityIdx: index("admin_audit_log_entity_type_entity_id_idx").on(table.entityType, table.entityId),
    adminUserIdx: index("admin_audit_log_admin_user_id_idx").on(table.adminUserId),
    createdAtIdx: index("admin_audit_log_created_at_idx").on(table.createdAt),
  }),
);
