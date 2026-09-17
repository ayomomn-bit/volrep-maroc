import type { ShopifyProductVariant } from "@/lib/backend/products";

// Pure function, unchanged from the original lib/shopify/variant.ts — it
// never talked to Shopify (or now, the Volrep backend) at all, so moving
// it here is just about keeping it next to the type it operates on.
//
// Resolves the variant matching every selected option, falling back to the
// product's first variant (mirrors the storefront's own "first available
// variant" convention) when the combination doesn't match — e.g. before
// any selection has been made.
export function findVariantBySelectedOptions(
  variants: ShopifyProductVariant[],
  selectedOptions: Record<string, string>,
): ShopifyProductVariant | null {
  const match = variants.find((variant) =>
    variant.selectedOptions.every((option) => selectedOptions[option.name] === option.value),
  );
  return match ?? variants[0] ?? null;
}
