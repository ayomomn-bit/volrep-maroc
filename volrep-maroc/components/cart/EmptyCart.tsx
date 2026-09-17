import { ButtonLink } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

// Standalone empty state — same eyebrow/heading recipe the legal pages use
// (components/legal/LegalPageLayout) so /cart reads as part of the same
// page system, without importing that component directly (this page isn't
// prose content, so it doesn't need the rest of that layout's shape).
export function EmptyCart() {
  return (
    <div className="flex flex-col items-center py-16 text-center sm:py-24">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
        VOLREP<span aria-hidden="true">™</span> / {t.cart.eyebrow}
      </p>

      <h1 className="mt-5 text-4xl uppercase leading-[0.95] tracking-[-0.02em] text-foreground sm:text-5xl">
        {t.cart.emptyTitle}
      </h1>

      <p className="mt-5 max-w-[440px] text-base leading-relaxed text-muted-foreground sm:text-lg">
        {t.cart.emptyPageBody}
      </p>

      <ButtonLink
        href="/products/volrep-prm"
        variant="primary"
        size="lg"
        className="mt-8 h-14 rounded-2xl !bg-volt px-8 text-base tracking-wide !text-white !transition-[background-color,translate,box-shadow] !duration-[250ms] !ease-out hover:-translate-y-1 hover:!bg-volt-deep hover:shadow-[0_22px_48px_-14px_rgba(11,11,11,0.45)]"
      >
        {t.cart.shopProductCta}
      </ButtonLink>
    </div>
  );
}
