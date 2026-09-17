import { toMoney, type Money } from "../lib/money.js";
import type { productImages, productOptions, products, productVariants } from "../db/schema/index.js";

type ProductRow = typeof products.$inferSelect;
type ProductImageRow = typeof productImages.$inferSelect;
type ProductOptionRow = typeof productOptions.$inferSelect;
type ProductVariantRow = typeof productVariants.$inferSelect;

export type ApiImage = { url: string; altText: string | null; width: number | null; height: number | null };

export type ApiVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  price: Money;
  compareAtPrice: Money | null;
  image: ApiImage | null;
};

export type ApiProductSummary = {
  id: string;
  title: string;
  handle: string;
  productType: string;
  tags: string[];
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: { minVariantPrice: Money };
};

export type ApiProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  featuredImage: ApiImage | null;
  images: ApiImage[];
  options: { id: string; name: string; values: string[] }[];
  variants: ApiVariant[];
  price: Money;
  compareAtPrice: Money | null;
};

function mapImage(image: ProductImageRow): ApiImage {
  return { url: image.url, altText: image.altText, width: image.width, height: image.height };
}

// A variant is purchasable — and reported as such to the storefront —
// only when the admin hasn't disabled it AND stock actually covers at
// least one unit. Deliberately not implementing a "preorder despite zero
// stock" mode in V1; available_for_sale stays a plain kill-switch until
// that's an actual requirement.
function isVariantAvailable(variant: ProductVariantRow): boolean {
  return variant.availableForSale && variant.stock > 0;
}

function mapVariant(variant: ProductVariantRow, image: ProductImageRow | null): ApiVariant {
  const price = Number(variant.priceAmount);
  const compareAt = variant.compareAtAmount ? Number(variant.compareAtAmount) : null;

  return {
    id: variant.id,
    title: variant.title,
    availableForSale: isVariantAvailable(variant),
    selectedOptions: variant.selectedOptions,
    price: toMoney(variant.priceAmount, variant.priceCurrency),
    // Only a genuine discount is surfaced — mirrors the existing frontend
    // rule in lib/shopify/products.ts's mapProduct (a stale compareAt
    // equal to or below price renders as a normal price, not struck-through).
    compareAtPrice: compareAt !== null && compareAt > price ? toMoney(variant.compareAtAmount as string, variant.priceCurrency) : null,
    image: image ? mapImage(image) : null,
  };
}

export function mapProductSummary(
  product: ProductRow,
  priceInfo: { minPrice: string; currency: string } | null,
  featuredImage: ProductImageRow | null,
): ApiProductSummary {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    productType: product.productType,
    tags: product.tags,
    featuredImage: featuredImage ? { url: featuredImage.url, altText: featuredImage.altText } : null,
    priceRange: {
      minVariantPrice: priceInfo ? toMoney(priceInfo.minPrice, priceInfo.currency) : toMoney("0", "MAD"),
    },
  };
}

export function mapProductDetail(
  product: ProductRow,
  images: ProductImageRow[],
  options: ProductOptionRow[],
  variants: ProductVariantRow[],
  imageById: Map<string, ProductImageRow>,
): ApiProduct {
  const mappedVariants = variants.map((variant) => mapVariant(variant, variant.imageId ? (imageById.get(variant.imageId) ?? null) : null));

  const prices = variants.map((v) => Number(v.priceAmount));
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const currency = variants[0]?.priceCurrency ?? "MAD";

  const compareAtCandidates = variants
    .map((v) => (v.compareAtAmount ? Number(v.compareAtAmount) : null))
    .filter((v): v is number => v !== null);
  const minCompareAt = compareAtCandidates.length > 0 ? Math.min(...compareAtCandidates) : null;

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description,
    availableForSale: variants.some(isVariantAvailable),
    featuredImage: images[0] ? mapImage(images[0]) : null,
    images: images.map(mapImage),
    options: options.map((option) => ({ id: option.id, name: option.name, values: option.values })),
    variants: mappedVariants,
    price: toMoney(minPrice.toFixed(2), currency),
    compareAtPrice: minCompareAt !== null && minCompareAt > minPrice ? toMoney(minCompareAt.toFixed(2), currency) : null,
  };
}
