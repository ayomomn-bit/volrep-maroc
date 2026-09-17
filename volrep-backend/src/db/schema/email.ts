import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Outbox pattern (Architecture §12): a business event (order placed,
// fulfillment added) inserts a row here in the same transaction as the
// state change, so the intent to send survives a crash. A lightweight
// poller (no Redis/BullMQ — Phase 3 rule #12) picks up 'pending' rows.
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toEmail: text("to_email").notNull(),
    template: text("template").notNull(),
    data: jsonb("data").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index("email_outbox_status_idx").on(table.status),
    statusCheck: check("email_outbox_status_check", sql`${table.status} in ('pending', 'sent', 'failed')`),
    templateCheck: check(
      "email_outbox_template_check",
      sql`${table.template} in ('order_confirmation', 'shipping_update', 'refund_confirmation')`,
    ),
  }),
);
