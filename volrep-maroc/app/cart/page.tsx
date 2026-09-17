import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { CartPageClient } from "@/components/cart/CartPageClient";
import { getCurrentCart } from "@/lib/backend/cart";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t.metadata.cartTitle,
  description: t.metadata.cartDescription,
};

// Reads the cart cookie via next/headers — this is what opts /cart into
// per-request dynamic rendering (as it should: cart contents are always
// visitor-specific). This route's own layout dependency stays local to
// itself; the homepage and product pages don't read cookies anywhere in
// their tree, so they keep their existing ISR untouched.
export default async function CartPage() {
  const cart = await getCurrentCart();

  return (
    <div className="bg-background pt-10 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
      <PageContainer>
        <CartPageClient initialCart={cart} />
      </PageContainer>
    </div>
  );
}
