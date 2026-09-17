import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import {
  productImages,
  productLandingPages,
  productOptions,
  productVariants,
  products,
} from "../../db/schema/index.js";
import { mapProductStudio } from "../../mappers/admin.js";

async function loadProductOr404(productId: string) {
  const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!row) throw AppError.notFound("Product not found");
  return row;
}

async function loadStudioParts(productId: string) {
  const product = await loadProductOr404(productId);
  const [images, options, variants, landingPages] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position)),
    db.select().from(productOptions).where(eq(productOptions.productId, productId)).orderBy(asc(productOptions.position)),
    db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(asc(productVariants.position)),
    db
      .select()
      .from(productLandingPages)
      .where(eq(productLandingPages.productId, productId))
      .orderBy(asc(productLandingPages.createdAt)),
  ]);
  return { product, images, options, variants, landingPages };
}

// The Product Studio payload for one product: the product itself + its
// variants/options + media + the (cache-only) Lirya landing-page binding.
//
// It NEVER calls the Lirya API, so a slow or unavailable Lirya can never
// delay Product Studio; the "Pages marketing" tab refreshes the binding
// cache through its own endpoint (routes/admin/landing-pages.ts).
//
// The Hero + content-block editing surface was removed once landing-page
// content ownership moved fully to Lirya. The `hero_*` columns and the
// `product_content_blocks` table still exist in the DB — a destructive
// cleanup is a separate, later phase — but nothing reads them here.
export async function getProductStudio(productId: string) {
  return mapProductStudio({ ...(await loadStudioParts(productId)), liryaAdminBaseUrl: env.LIRYA_ADMIN_BASE_URL });
}
