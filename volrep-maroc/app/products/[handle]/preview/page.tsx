import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProduct } from "@/lib/backend/products";
import { getProductReviews } from "@/lib/backend/reviews";
import { getStorefrontProductPage } from "@/lib/backend/product-page";
import { ProductLanding } from "@/components/product-landing/ProductLanding";
import "../product-landing.css";

// Draft preview of the "Page produit" document. Opened from Product Studio
// with a short-lived signed token (?token=…) minted by the admin backend
// (volrep-backend/src/lib/product-page/preview-token.js). With a valid
// token the backend serves the UNPUBLISHED draft; without one it serves the
// published page. Uses the SAME <ProductLanding> as the live route — this
// is not a second page implementation.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// The token is per-request state and the draft must never be cached.
export const dynamic = "force-dynamic";

const BANNER_STYLE: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 9999,
  background: "#111827",
  color: "#fff",
  font: "600 12px/1.4 system-ui, -apple-system, sans-serif",
  letterSpacing: "0.04em",
  textAlign: "center",
  padding: "8px 12px",
};

export default async function ProductPagePreview({
  params,
  searchParams,
}: PageProps<"/products/[handle]/preview">) {
  const { handle } = await params;
  const sp = await searchParams;
  const raw = sp.token;
  const token = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  const [product, reviewSummary, pageResult] = await Promise.all([
    getProduct(handle),
    getProductReviews(handle),
    getStorefrontProductPage(handle, { previewToken: token }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <>
      <div style={BANNER_STYLE}>
        {pageResult.preview
          ? "APERÇU — brouillon non publié. Cette page n’est pas visible par les clients."
          : "APERÇU — jeton absent, invalide ou expiré : la version publiée est affichée."}
      </div>
      <ProductLanding product={product} reviewSummary={reviewSummary} page={pageResult.page} />
    </>
  );
}
