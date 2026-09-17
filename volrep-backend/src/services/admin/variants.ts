import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { cartLines, carts, productVariants, products } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminVariant } from "../../mappers/admin.js";
import type { AdminContext } from "./auth.js";

// A money string like "899.00" — numeric(10,2). Non-negative, at most two
// decimals. Callers (Zod) also guard, this is defence in depth.
function assertMoneyString(label: string, value: string): void {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) {
    throw AppError.badRequest(`${label} must be a non-negative amount with at most 2 decimals.`);
  }
}

// A compare-at price only makes sense as a strike-through "was" price, so
// it must be strictly greater than the actual selling price. The storefront
// mapper already hides a non-greater compareAt; rejecting it here keeps
// meaningless data out of the table entirely.
function assertCompareAtAbovePrice(priceAmount: string, compareAtAmount: string): void {
  if (Number(compareAtAmount) <= Number(priceAmount)) {
    throw AppError.badRequest("Le prix barré doit être strictement supérieur au prix de vente.");
  }
}

export type CreateVariantInput = {
  title: string;
  sku?: string | null | undefined;
  priceAmount: string;
  priceCurrency?: string | undefined;
  compareAtAmount?: string | null | undefined;
  stock?: number | undefined;
  availableForSale?: boolean | undefined;
  selectedOptions?: { name: string; value: string }[] | undefined;
  position?: number | undefined;
};

export async function createVariant(admin: AdminContext, productId: string, input: CreateVariantInput) {
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw AppError.notFound("Product not found");

  assertMoneyString("Price", input.priceAmount);
  if (input.compareAtAmount != null) {
    assertMoneyString("Compare-at price", input.compareAtAmount);
    assertCompareAtAbovePrice(input.priceAmount, input.compareAtAmount);
  }
  if (input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < 0)) {
    throw AppError.badRequest("Stock must be a non-negative integer.");
  }

  if (input.sku) {
    const [dupe] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, input.sku)).limit(1);
    if (dupe) throw new AppError(409, "SKU_TAKEN", `SKU "${input.sku}" is already in use.`);
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productVariants)
      .values({
        productId,
        title: input.title,
        sku: input.sku ?? null,
        selectedOptions: input.selectedOptions ?? [],
        priceAmount: input.priceAmount,
        priceCurrency: input.priceCurrency ?? "MAD",
        compareAtAmount: input.compareAtAmount ?? null,
        stock: input.stock ?? 0,
        availableForSale: input.availableForSale ?? true,
        position: input.position ?? 0,
      })
      .returning();
    if (!row) throw new Error("Variant insert returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "variant.create",
      entityType: "product_variant",
      entityId: row.id,
      metadata: {
        productId,
        title: row.title,
        sku: row.sku,
        price: row.priceAmount,
        currency: row.priceCurrency,
        stock: row.stock,
      },
    });

    return mapAdminVariant(row);
  });
}

export type UpdateVariantInput = {
  title?: string | undefined;
  sku?: string | null | undefined;
  priceAmount?: string | undefined;
  priceCurrency?: string | undefined;
  compareAtAmount?: string | null | undefined;
  availableForSale?: boolean | undefined;
  selectedOptions?: { name: string; value: string }[] | undefined;
  position?: number | undefined;
};

// NOTE: stock is deliberately NOT updatable here — inventory changes go
// through adjustInventory() (src/services/admin/inventory.ts) so every
// stock movement is reason-tagged and audited with before/after. A plain
// "set stock to N" on the variant-edit endpoint would bypass that.
export async function updateVariant(admin: AdminContext, variantId: string, input: UpdateVariantInput) {
  const [current] = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
  if (!current) throw AppError.notFound("Variant not found");

  if (input.priceAmount !== undefined) assertMoneyString("Price", input.priceAmount);
  if (input.compareAtAmount != null) {
    assertMoneyString("Compare-at price", input.compareAtAmount);
    assertCompareAtAbovePrice(input.priceAmount ?? current.priceAmount, input.compareAtAmount);
  }

  if (input.sku && input.sku !== current.sku) {
    const [dupe] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, input.sku)).limit(1);
    if (dupe) throw new AppError(409, "SKU_TAKEN", `SKU "${input.sku}" is already in use.`);
  }

  const patch: Partial<typeof productVariants.$inferInsert> = { updatedAt: new Date() };
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const diff = (before: unknown, after: unknown): boolean =>
    after !== undefined && JSON.stringify(before) !== JSON.stringify(after);

  if (diff(current.title, input.title)) {
    patch.title = input.title!;
    changed.title = { from: current.title, to: input.title };
  }
  if (diff(current.sku, input.sku)) {
    patch.sku = input.sku ?? null;
    changed.sku = { from: current.sku, to: input.sku };
  }
  if (diff(current.priceAmount, input.priceAmount)) {
    patch.priceAmount = input.priceAmount!;
    changed.priceAmount = { from: current.priceAmount, to: input.priceAmount };
  }
  if (diff(current.priceCurrency, input.priceCurrency)) {
    patch.priceCurrency = input.priceCurrency!;
    changed.priceCurrency = { from: current.priceCurrency, to: input.priceCurrency };
  }
  if (diff(current.compareAtAmount, input.compareAtAmount)) {
    patch.compareAtAmount = input.compareAtAmount ?? null;
    changed.compareAtAmount = { from: current.compareAtAmount, to: input.compareAtAmount };
  }
  if (diff(current.availableForSale, input.availableForSale)) {
    patch.availableForSale = input.availableForSale!;
    changed.availableForSale = { from: current.availableForSale, to: input.availableForSale };
  }
  if (diff(current.selectedOptions, input.selectedOptions)) {
    patch.selectedOptions = input.selectedOptions!;
    changed.selectedOptions = { from: current.selectedOptions, to: input.selectedOptions };
  }
  if (diff(current.position, input.position)) {
    patch.position = input.position!;
    changed.position = { from: current.position, to: input.position };
  }

  if (Object.keys(changed).length === 0) {
    return mapAdminVariant(current);
  }

  return db.transaction(async (tx) => {
    const [row] = await tx.update(productVariants).set(patch).where(eq(productVariants.id, variantId)).returning();
    if (!row) throw new Error("Variant update returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "variant.update",
      entityType: "product_variant",
      entityId: variantId,
      metadata: { changed },
    });

    return mapAdminVariant(row);
  });
}

// A genuinely-live shopping cart: someone could still be checking out with
// it. This is the ONLY cart state that blocks a variant deletion. A
// 'converted' / 'abandoned' cart, or an 'active' one past its expiry, is
// dead — its cart_lines are never read again (src/services/cart.ts and
// src/services/checkout.ts only ever query lines of an active, non-expired
// cart) and only exist as an ON DELETE RESTRICT obstacle.
const activeCartCondition = () => and(eq(carts.status, "active"), gt(carts.expiresAt, new Date()));

// Hard-delete a variant. The schema is built for this: order_line_items
// keep a frozen snapshot (title / sku / price) and their variant_id FK is
// ON DELETE SET NULL, so historical orders are never touched. We refuse
// two cases up front with a clear 409:
//   - LAST_VARIANT: the product's only remaining variant (deleting it
//     would leave an unbuyable "0 MAD" product on the storefront).
//   - VARIANT_IN_CART: a genuinely active, non-expired cart references it
//     (a shopper could still be checking out). "Retire it instead" is what
//     availableForSale:false is for — there is no soft-delete.
// Dead cart_lines (converted / abandoned / expired carts) are cleared
// inside the same transaction as the delete + audit so the ON DELETE
// RESTRICT FK is satisfied for a legitimately-deletable variant. Genuinely
// active cart lines are NEVER touched — the 409 above already rejected
// that path, and the FK remains as the hard backstop.
export async function deleteVariant(admin: AdminContext, variantId: string) {
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
  if (!variant) throw AppError.notFound("Variant not found");

  const [siblings] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productVariants)
    .where(eq(productVariants.productId, variant.productId));
  if ((siblings?.count ?? 0) <= 1) {
    throw AppError.conflict(
      "LAST_VARIANT",
      "A product must keep at least one variant. Add another variant before deleting this one.",
    );
  }

  const [activeInCart] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cartLines)
    .innerJoin(carts, eq(cartLines.cartId, carts.id))
    .where(and(eq(cartLines.variantId, variantId), activeCartCondition()));
  if ((activeInCart?.count ?? 0) > 0) {
    throw AppError.conflict(
      "VARIANT_IN_CART",
      "This variant is in an active shopping cart and cannot be deleted. Turn off “Available for sale” instead.",
      { cartLineCount: activeInCart?.count ?? 0 },
    );
  }

  return db.transaction(async (tx) => {
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "variant.delete",
      entityType: "product_variant",
      entityId: variantId,
      metadata: {
        productId: variant.productId,
        title: variant.title,
        sku: variant.sku,
        price: variant.priceAmount,
        currency: variant.priceCurrency,
        finalStock: variant.stock,
      },
    });

    // Clear the variant's dead cart references (converted / abandoned /
    // expired carts only — a genuinely active cart was rejected with a 409
    // above). This satisfies the ON DELETE RESTRICT FK without weakening
    // it. Scoped by an EXISTS on a non-active cart so an active line can
    // never be removed even if one raced in after the check.
    await tx.delete(cartLines).where(
      and(
        eq(cartLines.variantId, variantId),
        sql`not exists (
          select 1 from ${carts}
          where ${carts.id} = ${cartLines.cartId}
            and ${carts.status} = 'active'
            and ${carts.expiresAt} > now()
        )`,
      ),
    );

    // Defence in depth: if a genuinely active cart line raced in between
    // the check and here, it was NOT cleared above, so ON DELETE RESTRICT
    // makes this throw — caught and surfaced as the same clean 409, and
    // the whole transaction (including the dead-line cleanup) rolls back.
    try {
      await tx.delete(productVariants).where(eq(productVariants.id, variantId));
    } catch (err) {
      if (err instanceof Error && /foreign key|violates/i.test(err.message)) {
        throw AppError.conflict(
          "VARIANT_IN_CART",
          "This variant is in an active shopping cart and cannot be deleted. Turn off “Available for sale” instead.",
        );
      }
      throw err;
    }

    return { id: variantId };
  });
}
