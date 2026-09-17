"use client";

import { usePathname } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { t } from "@/lib/i18n";

// Deliberate exception to "blue is a restrained accent everywhere else" —
// this bar, directly above the (black) Header, is one of the storefront's
// intentional full-strength brand-blue moments: a solid VOLREP Blue fill
// with white text, no dot/black treatment. See app/globals.css's brand-
// token comment for the fuller "where blue is allowed to be a fill vs. an
// accent" rationale.
//
// Step 2: on a product detail page this slot instead shows the
// conversion-focused promotional-offer bar that used to live inside the
// product landing tree (`.top-bar`). It was moved here so it renders as the
// very first element on the page, above the global Header — its design,
// text, colour and (static) behaviour are unchanged from the reference.
// `usePathname()` is the only reason this component is now client-side;
// every non-product route renders the exact same generic bar as before.
export function PromoBar() {
  const pathname = usePathname() ?? "";
  const isProductPage = /^\/products\/[^/]+\/?$/.test(pathname);

  if (isProductPage) {
    return (
      <div
        style={{ backgroundImage: "linear-gradient(90deg, var(--volt), var(--volt-deep))" }}
        className="px-3 py-2.5 text-center text-[12.5px] font-medium tracking-[0.3px] text-white"
      >
        🔥 OFFRE SPÉCIALE — Jusqu’à <strong className="font-bold">-40%</strong> aujourd’hui seulement
      </div>
    );
  }

  return (
    <div className="bg-volt">
      <Container>
        <p className="flex h-9 items-center justify-center text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white">
          {t.promoBar.message}
        </p>
      </Container>
    </div>
  );
}
