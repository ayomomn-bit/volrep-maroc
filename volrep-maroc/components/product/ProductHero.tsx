import { PageContainer } from "@/components/layout/PageContainer";
import { PaymentMethods } from "@/components/product/PaymentMethods";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { TrustBadges } from "@/components/product/TrustBadges";
import type { ShopifyProduct } from "@/lib/backend/products";
import type { ProductReviewSummary } from "@/lib/backend/reviews";

// The page's composition root — stays a Server Component itself. Only
// ProductGallery (thumbnail/swipe state) and ProductInfo (the product
// form's selection state) cross into the client; TrustBadges and
// PaymentMethods have neither Shopify data nor interactivity, so they're
// passed into ProductInfo as slots rather than imported there, keeping
// them server-rendered.
//
// Uses <PageContainer> (1440px) rather than the shared <Container>
// (max-w-7xl / 1280px, used by Header/Footer's text column and every
// homepage section) — every section on this page shares that one wider
// container so their edges line up exactly; see PageContainer's own
// comment for why that value isn't forked per-section.
export function ProductHero({
  product,
  reviewSummary,
}: {
  product: ShopifyProduct;
  reviewSummary: ProductReviewSummary;
}) {
  return (
    // Top padding stays minimal (16-24px) so the product is the first
    // thing in view under the header. Bottom padding matches the shared
    // 48px/56px section-rhythm token (see LifestyleBenefits' py-12 lg:py-14)
    // rather than a hero-specific "space before the footer" value — this
    // page's next section is LifestyleBenefits, not the footer, and the two
    // halves combine to the requested 96-120px gap between sections.
    <section className="pt-4 pb-12 sm:pt-5 sm:pb-12 lg:pt-6 lg:pb-14">
      <PageContainer>
        {/* items-start: neither column stretches to match the other's
            height — required for ProductGallery's sticky to have real
            travel room, and it's what stops whichever column is shorter
            from rendering an invisible stretched box past its own content.
            11fr/9fr ≈ 55%/45%, per spec. Column gap stays deliberately
            tighter than the section's own padding — the two columns read
            as one composition, not two separate blocks. */}
        <div className="grid gap-14 lg:grid-cols-[11fr_9fr] lg:items-start lg:gap-12 xl:gap-14">
          <ProductGallery images={product.images} title={product.title} />
          <ProductInfo
            product={product}
            reviewSummary={reviewSummary}
            trustBadges={<TrustBadges />}
            paymentMethods={<PaymentMethods />}
          />
        </div>
      </PageContainer>
    </section>
  );
}
