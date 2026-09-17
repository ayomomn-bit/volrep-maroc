import { and, asc, eq, gt } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { carts, cartLines, productImages, productVariants, products } from "../db/schema/index.js";
import { mapCart, type ApiCart, type CartLineJoinRow } from "../mappers/cart.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = PgTransaction<any, any, any>;

function cartExpiryDate(): Date {
  return new Date(Date.now() + env.CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

async function touchCart(tx: Tx, cartId: string): Promise<void> {
  await tx.update(carts).set({ expiresAt: cartExpiryDate(), updatedAt: new Date() }).where(eq(carts.id, cartId));
}

// Resolves to an active, non-expired cart id — creating a fresh cart when
// none was supplied, or when the supplied one no longer resolves (the
// cookie can outlive the cart: it expired, or was already converted by a
// prior checkout). Mirrors the "fall through to a fresh cart" behavior in
// the current frontend's addToCartAction (Architecture §06).
async function ensureActiveCart(tx: Tx, cartId: string | null): Promise<string> {
  if (cartId) {
    const [existing] = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.id, cartId), eq(carts.status, "active"), gt(carts.expiresAt, new Date())))
      .limit(1);
    if (existing) return existing.id;
  }

  const [created] = await tx.insert(carts).values({ expiresAt: cartExpiryDate() }).returning({ id: carts.id });
  if (!created) throw new Error("Failed to create cart");
  return created.id;
}

async function loadCartLineRows(cartId: string): Promise<CartLineJoinRow[]> {
  const rows = await db
    .select({
      lineId: cartLines.id,
      quantity: cartLines.quantity,
      variantId: productVariants.id,
      variantTitle: productVariants.title,
      selectedOptions: productVariants.selectedOptions,
      priceAmount: productVariants.priceAmount,
      priceCurrency: productVariants.priceCurrency,
      productTitle: products.title,
      productHandle: products.handle,
      imageUrl: productImages.url,
      imageAltText: productImages.altText,
      imageWidth: productImages.width,
      imageHeight: productImages.height,
    })
    .from(cartLines)
    .innerJoin(productVariants, eq(cartLines.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(productImages, eq(productVariants.imageId, productImages.id))
    .where(eq(cartLines.cartId, cartId))
    .orderBy(asc(cartLines.createdAt));

  return rows.map((row) => ({
    lineId: row.lineId,
    quantity: row.quantity,
    variantId: row.variantId,
    variantTitle: row.variantTitle,
    selectedOptions: row.selectedOptions,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    productTitle: row.productTitle,
    productHandle: row.productHandle,
    image: row.imageUrl ? { url: row.imageUrl, altText: row.imageAltText, width: row.imageWidth, height: row.imageHeight } : null,
  }));
}

// Returns null for a missing, expired, or already-converted cart — the
// same "no error, just no cart" contract as today's getCartAction().
export async function getCart(cartId: string): Promise<ApiCart | null> {
  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.id, cartId), eq(carts.status, "active"), gt(carts.expiresAt, new Date())))
    .limit(1);

  if (!cart) return null;

  const rows = await loadCartLineRows(cart.id);
  return mapCart(cart.id, cart.currency, rows);
}

async function assertPurchasable(tx: Tx, variantId: string, requestedQuantity: number): Promise<void> {
  const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for("update");
  if (!variant) throw AppError.notFound("Variant not found");

  const [product] = await tx.select({ status: products.status }).from(products).where(eq(products.id, variant.productId)).limit(1);
  if (!product || product.status !== "active") throw AppError.notFound("Variant not found");

  if (!variant.availableForSale || variant.stock < requestedQuantity) {
    throw AppError.conflict("OUT_OF_STOCK", "This item does not have enough stock available.", { variantId });
  }
}

export async function addCartLine(cartId: string | null, variantId: string, quantity: number): Promise<ApiCart> {
  const resolvedCartId = await db.transaction(async (tx) => {
    const activeCartId = await ensureActiveCart(tx, cartId);

    const [existingLine] = await tx
      .select()
      .from(cartLines)
      .where(and(eq(cartLines.cartId, activeCartId), eq(cartLines.variantId, variantId)))
      .limit(1);
    const newQuantity = (existingLine?.quantity ?? 0) + quantity;

    // Locks the variant row for the duration of this transaction — two
    // concurrent add-to-cart requests for the last unit of stock can't
    // both pass this check.
    await assertPurchasable(tx, variantId, newQuantity);

    if (existingLine) {
      await tx.update(cartLines).set({ quantity: newQuantity, updatedAt: new Date() }).where(eq(cartLines.id, existingLine.id));
    } else {
      await tx.insert(cartLines).values({ cartId: activeCartId, variantId, quantity: newQuantity });
    }

    await touchCart(tx, activeCartId);
    return activeCartId;
  });

  const cart = await getCart(resolvedCartId);
  if (!cart) throw new Error("Cart unexpectedly missing immediately after creation");
  return cart;
}

async function loadOwnedLine(tx: Tx, cartId: string, lineId: string) {
  const [line] = await tx.select().from(cartLines).where(eq(cartLines.id, lineId)).limit(1);
  if (!line) throw AppError.notFound("Cart line not found");
  // Ownership check: the line's cart must match the cart id the caller
  // supplied — never trust the line id alone (Architecture §04).
  if (line.cartId !== cartId) throw AppError.forbidden("This cart line does not belong to the provided cart");
  return line;
}

export async function updateCartLine(cartId: string, lineId: string, quantity: number): Promise<ApiCart> {
  // quantity < 1 behaves as a removal, matching the documented contract.
  if (quantity < 1) return removeCartLine(cartId, lineId);

  await db.transaction(async (tx) => {
    const line = await loadOwnedLine(tx, cartId, lineId);
    await assertPurchasable(tx, line.variantId, quantity);
    await tx.update(cartLines).set({ quantity, updatedAt: new Date() }).where(eq(cartLines.id, lineId));
    await touchCart(tx, cartId);
  });

  const cart = await getCart(cartId);
  if (!cart) throw AppError.notFound("Cart not found");
  return cart;
}

export async function removeCartLine(cartId: string, lineId: string): Promise<ApiCart> {
  await db.transaction(async (tx) => {
    await loadOwnedLine(tx, cartId, lineId);
    await tx.delete(cartLines).where(eq(cartLines.id, lineId));
    await touchCart(tx, cartId);
  });

  const cart = await getCart(cartId);
  if (!cart) throw AppError.notFound("Cart not found");
  return cart;
}
