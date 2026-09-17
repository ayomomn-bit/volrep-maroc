"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/layout/PageContainer";
import type { ShopifyMoney, ShopifyProduct } from "@/lib/backend/products";

// Same Intl.NumberFormat recipe as ProductPrice.tsx/ProductCard.tsx — those
// keep their own copies too (neither exports one), so this follows the
// established per-component pattern rather than introducing a new shared
// util for a three-line formatter.
function formatPrice({ amount, currencyCode }: ShopifyMoney): string | null {
  const value = Number(amount);
  if (Number.isNaN(value)) return null;

  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// Matches TrustBadges.tsx / Footer.tsx's own already-shipped figures
// exactly — not new claims, just the same three facts in plain text
// appropriate for this section's minimal, dark, closing-statement tone.
const REASSURANCE = "Livraison offerte · Retours sous 30 jours · Garantie 2 ans";

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below. Same
// duplicated scroll-reveal pattern used throughout the site.
const REVEAL_DELAYS = ["delay-[0ms]", "delay-[80ms]", "delay-[160ms]", "delay-[240ms]", "delay-[320ms]", "delay-[400ms]"];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ArrowIcon() {
  return (
    <span aria-hidden="true" className="inline-block transition-transform duration-300 ease-out group-hover:translate-x-1">
      →
    </span>
  );
}

// The page's closing statement — deliberately leaner than ProductHero
// (no variant picker, quantity selector, or payment-method row): the Hero
// answers "what is this?", this answers "ready to get it?". Reuses the
// product's own Shopify data (title, price, featuredImage) rather than any
// invented copy, and the same isolated-cutout-on-black treatment already
// proven in Technology.tsx for this exact image asset. Named
// ProductFinalCTA (not FinalCTA) so importing it never collides with
// components/home/FinalCTA.tsx.
export function ProductFinalCTA({ product }: { product: ShopifyProduct }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // No anchor/id exists in ProductHero's subtree to link to (it's a
  // protected section — not modifying it just to add one), and this page's
  // buy box is that section, at the very top. A plain scroll-to-top is the
  // simplest correct way to send the customer back to Add to Cart.
  function scrollToBuyBox() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  const image = product.featuredImage;
  const formattedPrice = formatPrice(product.price);
  const productName = `${product.title} — Masseur de récupération percussive`;

  return (
    <section
      ref={sectionRef}
      // Two headings exist in the DOM (desktop/mobile layout variants,
      // exactly one visible at a time via CSS) — both ids are listed here
      // rather than one, since the accessible-name computation for the
      // hidden one is a spec edge case not worth relying on.
      aria-labelledby="final-cta-heading-desktop final-cta-heading-mobile"
      className="bg-ink py-20 sm:py-24 lg:py-[120px]"
    >
      <PageContainer>
        {/* Desktop / large-tablet: text left, product right — the reverse
            of ProductHero's gallery-left/info-right order, a deliberate
            differentiation so this doesn't read as "the Hero again". 9fr/11fr
            ≈ 45%/55%, per spec. */}
        <div className="hidden items-center gap-16 lg:grid lg:grid-cols-[9fr_11fr] xl:gap-20">
          <div>
            <p
              className={`flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-paper/60 ${revealClass(visible, 0)}`}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
              VOLREP PRM<span aria-hidden="true">™</span>
            </p>

            <h2
              id="final-cta-heading-desktop"
              className={`mt-5 text-5xl uppercase leading-[0.94] tracking-[-0.03em] text-paper xl:text-6xl ${revealClass(visible, 1)}`}
            >
              Mieux récupérer.
              <br />
              Chaque jour.
            </h2>

            <p className={`mt-6 max-w-[400px] text-base leading-relaxed text-paper/65 ${revealClass(visible, 2)}`}>
              Une récupération ciblée, un contrôle mains libres et un design pensé pour s’intégrer naturellement à votre routine.
            </p>

            <div className={`mt-9 ${revealClass(visible, 3)}`}>
              <p className="text-[15px] font-medium text-paper">{productName}</p>
              {formattedPrice && <p className="mt-1.5 text-2xl font-bold text-paper">{formattedPrice}</p>}
            </div>

            <div className={`mt-7 ${revealClass(visible, 3)}`}>
              <Button
                type="button"
                onClick={scrollToBuyBox}
                variant="primary"
                size="lg"
                className="group !bg-volt !text-white hover:!bg-volt-deep"
              >
                Obtenir le VOLREP PRM<span aria-hidden="true">™</span>
                <ArrowIcon />
              </Button>
            </div>

            <p className={`mt-5 text-xs text-paper/45 ${revealClass(visible, 4)}`}>{REASSURANCE}</p>
          </div>

          <div className="relative aspect-[4/3] w-full">
            {/* Ambient glow, not a section-wide gradient — a soft, low-opacity
                blue blob confined behind the product so the black background
                stays flat everywhere else. Same --volt blue as the CTA button,
                in raw rgba form for the alpha fade (see home/FinalCTA.tsx's
                own comment on this exact pattern). */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-10%] -z-10 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(54,143,253,0.16) 0%, rgba(54,143,253,0) 70%)" }}
            />
            <div
              className={`relative h-full w-full overflow-hidden transition-all duration-1000 ease-out ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
            >
              {image && (
                <Image src={image.url} alt={image.altText ?? product.title} fill sizes="55vw" className="object-cover" />
              )}
            </div>
          </div>
        </div>

        {/* Mobile / tablet: eyebrow → headline → copy → product → name →
            price → CTA → reassurance, per spec — not the desktop grid
            reflowed, since the product sits between the copy and the name/
            price/CTA block here rather than off to one side. */}
        <div className="text-center lg:hidden">
          <p
            className={`flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-paper/60 ${revealClass(visible, 0)}`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            VOLREP PRM<span aria-hidden="true">™</span>
          </p>

          <h2
            id="final-cta-heading-mobile"
            className={`mt-5 text-4xl uppercase leading-[0.94] tracking-[-0.03em] text-paper sm:text-5xl ${revealClass(visible, 1)}`}
          >
            Mieux récupérer.
            <br />
            Chaque jour.
          </h2>

          <p className={`mx-auto mt-5 max-w-[360px] text-base leading-relaxed text-paper/65 ${revealClass(visible, 2)}`}>
            Une récupération ciblée, un contrôle mains libres et un design pensé pour s’intégrer naturellement à votre routine.
          </p>

          <div className="relative mx-auto mt-10 aspect-[4/3] w-full max-w-[420px]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-10%] -z-10 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(54,143,253,0.16) 0%, rgba(54,143,253,0) 70%)" }}
            />
            <div
              className={`relative h-full w-full overflow-hidden transition-all duration-1000 ease-out ${
                visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
              }`}
            >
              {image && (
                <Image src={image.url} alt={image.altText ?? product.title} fill sizes="100vw" className="object-cover" />
              )}
            </div>
          </div>

          <div className={`mt-8 ${revealClass(visible, 3)}`}>
            <p className="text-[15px] font-medium text-paper">{productName}</p>
            {formattedPrice && <p className="mt-1.5 text-2xl font-bold text-paper">{formattedPrice}</p>}
          </div>

          <div className={`mx-auto mt-7 max-w-sm ${revealClass(visible, 3)}`}>
            <Button
              type="button"
              onClick={scrollToBuyBox}
              variant="primary"
              size="lg"
              className="group w-full !bg-volt !text-white hover:!bg-volt-deep"
            >
              Obtenir le VOLREP PRM<span aria-hidden="true">™</span>
              <ArrowIcon />
            </Button>
          </div>

          <p className={`mt-5 text-xs text-paper/45 ${revealClass(visible, 4)}`}>{REASSURANCE}</p>
        </div>
      </PageContainer>
    </section>
  );
}
