import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { productVariants, products } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminVariant } from "../../mappers/admin.js";
import type { AdminContext } from "./auth.js";

// V1 has no inventory_adjustments table (and the brief says not to add one
// yet) — the audit log IS the stock-movement ledger. Every adjustment
// records previousQuantity / newQuantity / delta / reason / admin, so the
// full history of any variant's stock is `SELECT ... FROM admin_audit_log
// WHERE entity_type = 'product_variant' AND action = 'inventory.adjust'`.

export type InventoryInput =
  // Set the stock to an exact value.
  | { mode: "set"; quantity: number; reason: string }
  // Add/subtract from current stock (negative delta allowed, result must
  // still be >= 0).
  | { mode: "adjust"; delta: number; reason: string };

export async function adjustInventory(admin: AdminContext, variantId: string, input: InventoryInput) {
  return db.transaction(async (tx) => {
    // Lock the row so two concurrent adjustments can't both read the same
    // "previous" value and lose one of the changes.
    const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for("update");
    if (!variant) throw AppError.notFound("Variant not found");

    const previous = variant.stock;
    const next = input.mode === "set" ? input.quantity : previous + input.delta;

    if (!Number.isInteger(next)) {
      throw AppError.badRequest("Resulting stock must be a whole number.");
    }
    if (next < 0) {
      throw new AppError(422, "NEGATIVE_INVENTORY", "Inventory cannot go below zero.", {
        previous,
        attempted: next,
      });
    }
    if (next === previous) {
      throw new AppError(409, "NO_INVENTORY_CHANGE", "This adjustment would not change the stock level.");
    }

    const [row] = await tx
      .update(productVariants)
      .set({ stock: next, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId))
      .returning();
    if (!row) throw new Error("Inventory update returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "inventory.adjust",
      entityType: "product_variant",
      entityId: variantId,
      metadata: {
        mode: input.mode,
        previousQuantity: previous,
        newQuantity: next,
        delta: next - previous,
        reason: input.reason,
      },
    });

    return mapAdminVariant(row);
  });
}

// Stock for a simple product (hasVariants: false). Resolves its Default
// Variant and delegates to adjustInventory() unchanged above — same lock,
// same audit trail (entityType stays "product_variant"), so
// GET /api/admin/variants/:variantId/inventory still shows its full
// history and nothing about stock movement is duplicated for this mode.
export async function adjustProductInventory(admin: AdminContext, productId: string, input: InventoryInput) {
  const [product] = await db.select({ hasVariants: products.hasVariants }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw AppError.notFound("Product not found");
  if (product.hasVariants) {
    throw AppError.conflict(
      "PRODUCT_HAS_VARIANTS",
      "This product manages stock per variant. Use the variant inventory endpoint instead.",
    );
  }

  const [variant] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, productId)).limit(1);
  if (!variant) throw new Error(`Simple product ${productId} has no Default Variant — data integrity bug`);

  return adjustInventory(admin, variant.id, input);
}

// Read the audit-log-backed adjustment history for one variant.
export async function inventoryHistory(variantId: string, limit: number) {
  const rows = await db.execute<{
    id: string;
    admin_user_id: string | null;
    metadata: unknown;
    created_at: Date;
  }>(sql`
    select id, admin_user_id, metadata, created_at
    from admin_audit_log
    where entity_type = 'product_variant'
      and entity_id = ${variantId}
      and action = 'inventory.adjust'
    order by created_at desc
    limit ${limit}
  `);
  return rows.map((r) => ({
    id: r.id,
    adminUserId: r.admin_user_id,
    ...(typeof r.metadata === "object" && r.metadata ? r.metadata : {}),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}
