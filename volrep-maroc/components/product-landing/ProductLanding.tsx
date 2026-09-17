import type { ShopifyProduct } from "@/lib/backend/products";
import type { ProductReviewSummary } from "@/lib/backend/reviews";
import type { PageDocument } from "@/lib/product-page/types";
import { formatMoney } from "@/lib/backend/money";
import { SectionRenderer } from "@/components/product-landing/SectionRenderer";
import { BuyQuantityProvider } from "@/components/product-landing/buy-quantity";
import type { SectionContext } from "@/components/product-landing/context";

// ---------------------------------------------------------------------------
// VOLREP product landing page — the entire product page, now driven by the
// "Page produit" document from Product Studio (GET /api/products/:handle/page,
// published version; the code-owned DEFAULT_PAGE_DOCUMENT is the fallback).
//
// This file is a thin shell: it computes the live commerce/review context
// (price, discount, images, reviews — all still owned by the product /
// reviews backends, never by the Studio document) and hands the ordered,
// visibility-filtered section list to <SectionRenderer>. Every section's
// markup, class names and DOM live in ./sections.tsx, copied 1:1 from the
// previous hardcoded implementation (kept for reference in
// ./ProductLanding.legacy.txt). See docs/product-page-inventory.md.
//
// The promotional-offer bar renders above the global <Header> — see
// components/layout/PromoBar.tsx — and is intentionally not part of this
// document.
// ---------------------------------------------------------------------------

export function ProductLanding({
  product,
  reviewSummary,
  page,
}: {
  product: ShopifyProduct;
  reviewSummary: ProductReviewSummary;
  page: PageDocument;
}) {
  const price = formatMoney(product.price) ?? "";
  const oldPrice = product.compareAtPrice ? formatMoney(product.compareAtPrice) : null;
  const compareValue = product.compareAtPrice ? Number(product.compareAtPrice.amount) : null;
  const discountPercent =
    compareValue && compareValue > 0
      ? Math.round((1 - Number(product.price.amount) / compareValue) * 100)
      : null;

  const ctx: SectionContext = { product, reviewSummary, price, oldPrice, discountPercent };

  return (
    <div className="plp">
      <BuyQuantityProvider>
        <SectionRenderer sections={page.sections} ctx={ctx} />
      </BuyQuantityProvider>
    </div>
  );
}
