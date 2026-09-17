import { notFound } from "next/navigation";
import { getProduct } from "@/lib/backend/products";
import { getProductReviews } from "@/lib/backend/reviews";
import { getStorefrontProductPage } from "@/lib/backend/product-page";
import { ProductLanding } from "@/components/product-landing/ProductLanding";
import "./product-landing.css";

// Product data (price, availability) and the editable "Page produit"
// document can both change between deploys — same staleness budget as the
// homepage's catalog fetch.
export const revalidate = 300;

// The product page IS the long-form conversion landing page
// (components/product-landing/*, scoped under `.plp` via product-landing.css).
// Its content, section order and visibility now come from the published
// Product Studio document (getStorefrontProductPage); the code-owned
// DEFAULT_PAGE_DOCUMENT — a 1:1 copy of the previous hardcoded content — is
// the fallback when the backend is unavailable. Product identity / price /
// variants stay live from getProduct(); reviews from getProductReviews().
export default async function ProductPage({ params }: PageProps<"/products/[handle]">) {
  const { handle } = await params;
  const [product, reviewSummary, pageResult] = await Promise.all([
    getProduct(handle),
    getProductReviews(handle),
    getStorefrontProductPage(handle),
  ]);

  if (!product) {
    notFound();
  }

  return <ProductLanding product={product} reviewSummary={reviewSummary} page={pageResult.page} />;
}
