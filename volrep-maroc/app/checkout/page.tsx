import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { CheckoutPageClient } from "@/components/checkout/CheckoutPageClient";
import { getCurrentCart } from "@/lib/backend/cart";
import { getProduct } from "@/lib/backend/products";
import {
  DIRECT_BUY_PARAM,
  DIRECT_QTY_PARAM,
  clampDirectQuantity,
  firstSearchParam,
  type DirectBuyContext,
} from "@/lib/backend/direct-checkout";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t.checkout.metaTitle,
  description: t.checkout.metaDescription,
};

// Resolves `/checkout?buy=<handle>&qty=<n>` into a server-verified context.
// Returns null only when the handle doesn't resolve to a real product — the
// page then falls through to the normal cart flow. Price / title / image all
// come from the live product, never the client (security §12). Stock is NOT
// gated here: an out-of-stock product still reaches the form and fails loudly
// on submit (submitDirectCheckoutAction), matching the inline COD form.
async function resolveDirectBuy(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<DirectBuyContext | null> {
  const handle = firstSearchParam(searchParams[DIRECT_BUY_PARAM]);
  if (!handle) return null;

  const quantity = clampDirectQuantity(firstSearchParam(searchParams[DIRECT_QTY_PARAM]) ?? "1");

  const product = await getProduct(handle);
  const variant = product?.variants[0] ?? null;
  if (!product || !variant) return null;

  return {
    handle: product.handle,
    title: product.title,
    image: variant.image ?? product.featuredImage ?? product.images[0] ?? null,
    unitPrice: variant.price ?? product.price,
    quantity,
  };
}

// Two ways in:
//   - normal:  reads the cart cookie via next/headers (getCurrentCart)
//   - direct:  `/checkout?buy=<handle>&qty=<n>` from "Commander maintenant" —
//              the cart cookie is NOT read or written.
// Both paths opt this route into per-request dynamic rendering, as they should.
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const sp = await searchParams;
  const directBuy = await resolveDirectBuy(sp);
  const cart = directBuy ? null : await getCurrentCart();

  return (
    <div className="bg-background pt-10 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
      <PageContainer>
        <CheckoutPageClient initialCart={cart} directBuy={directBuy} />
      </PageContainer>
    </div>
  );
}
