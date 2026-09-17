import { Container } from "@/components/layout/Container";
import { ProductCarousel } from "@/components/home/ProductCarousel";
import { getProducts } from "@/lib/backend/products";
import type { BestSellersSectionData } from "@/lib/homepage/types";

export async function BestSellers({ data }: { data: BestSellersSectionData }) {
  const products = await getProducts(data.source.limit);

  return (
    <section aria-labelledby="best-sellers-heading" className="border-t border-border bg-background">
      <Container className="py-16 sm:py-20 lg:py-24">
        <ProductCarousel
          products={products}
          heading={
            <div>
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
                VOLREP<span aria-hidden="true">™</span> {data.eyebrow}
              </p>

              <h2 id="best-sellers-heading" className="mt-4 text-3xl text-foreground sm:text-4xl lg:text-[2.5rem]">
                {data.heading}
              </h2>

              <p className="mt-3 max-w-sm text-base text-muted-foreground sm:text-lg">
                {data.body}
              </p>
            </div>
          }
        />
      </Container>
    </section>
  );
}
