"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import type { ShopifyProduct } from "@/lib/backend/products";

// Every row here is corroborated elsewhere in the app rather than invented
// for this section: the Shopify product description ("Advanced 4D massage
// roller for full-body recovery"), BenefitsList's buy-box copy ("Deep
// muscle recovery", "Improves circulation", "Daily full-body massage"), and
// this page's own HowItWorks/Technology sections ("Use your own body
// weight...", "Targeted contact designed to follow the contours of your
// muscles", "Built to move naturally with your body during recovery"). No
// battery/motor/percussion claims — those aren't in the verified product
// data, even though one older, inconsistent section mentions them.
const ROWS = [
  "Contact rotatif 4D",
  "Conception mains libres",
  "Pression ciblée",
  "Récupération au quotidien",
  "Utilisation sur tout le corps",
];

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below. Same
// duplicated scroll-reveal pattern used throughout the site.
const REVEAL_DELAYS = [
  "delay-[0ms]",
  "delay-[80ms]",
  "delay-[160ms]",
  "delay-[240ms]",
  "delay-[320ms]",
  "delay-[400ms]",
  "delay-[480ms]",
  "delay-[560ms]",
];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;
}

function CheckBadge({ visible, step }: { visible: boolean; step: number }) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-volt/[0.12] text-volt transition-all duration-500 ease-out ${delay} ${
        visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

function VolrepLabel({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.1em] text-foreground ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-volt" />
      VOLREP PRM<span aria-hidden="true">™</span>
    </span>
  );
}

// Same Shopify featuredImage the product hero's gallery shows first — an
// already-isolated, background-removed cutout (see Technology.tsx's own
// comment on this exact asset) — so this reads as the same product photo,
// not a new/different one, just shown small. alt="" (decorative): the
// adjacent VolrepLabel text already names the product for screen readers.
function FeaturedThumbnail({ image }: { image: ShopifyProduct["featuredImage"] }) {
  if (!image) return null;

  return (
    <span className="relative h-11 w-11 shrink-0">
      <Image src={image.url} alt="" fill sizes="44px" className="object-contain" />
    </span>
  );
}

// "Why VOLREP PRM™" comparison section — a light, editorial specification
// panel (real <table> markup for proper row/column semantics, styled away
// from any spreadsheet look) on desktop, and two stacked "VOLREP vs.
// Standard Roller" cards on mobile/tablet rather than a shrunk table.
export function Comparison({ product }: { product: ShopifyProduct }) {
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

  return (
    <section ref={sectionRef} aria-labelledby="comparison-heading" className="bg-background py-20 sm:py-24 lg:py-[120px]">
      <PageContainer>
        <div className="mx-auto max-w-2xl text-center">
          <p
            className={`flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground ${revealClass(visible, 0)}`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            Pourquoi le VOLREP PRM<span aria-hidden="true">™</span>
          </p>

          <h2
            id="comparison-heading"
            className={`mt-5 text-[1.75rem] uppercase leading-[0.94] tracking-[-0.02em] text-foreground sm:text-[2.375rem] lg:text-[2rem] xl:text-[2.875rem] ${revealClass(visible, 1)}`}
          >
            Conçu pour une meilleure récupération.
          </h2>

          <p
            className={`mx-auto mt-6 max-w-[440px] text-base leading-relaxed text-muted-foreground sm:text-lg ${revealClass(visible, 2)}`}
          >
            Découvrez ce qui change quand la récupération est pensée autour de votre corps.
          </p>
        </div>

        {/* Desktop / large-tablet: one continuous specification panel.
            Semantic <table> (scope="col"/"row") for real comparison-table
            a11y, styled with no grid lines beyond soft row dividers and a
            faint tint marking the VOLREP column so it reads as a premium
            panel rather than a spreadsheet. Hidden below lg — mobile gets
            its own stacked layout further down instead of a squeezed table. */}
        <div
          className={`mx-auto mt-14 hidden max-w-3xl overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_20px_50px_-28px_rgba(11,11,11,0.16)] lg:block ${revealClass(visible, 2)}`}
        >
          <table className="w-full border-collapse text-left">
            <colgroup>
              <col />
              <col className="w-[220px]" />
              <col className="w-[160px]" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="border-b border-black/[0.06] px-8 py-5 font-normal" />
                <th
                  scope="col"
                  className="border-b border-black/[0.06] border-t-[3px] border-t-volt bg-volt/[0.05] px-4 py-5 text-center font-normal"
                >
                  {/* Thumbnail beside the label on desktop (row), stacked
                      above it on mobile below — same two elements, just
                      reflowed per the brief's two layouts. */}
                  <div className="flex items-center justify-center gap-2.5">
                    <FeaturedThumbnail image={product.featuredImage} />
                    <VolrepLabel />
                  </div>
                </th>
                <th scope="col" className="border-b border-black/[0.06] px-4 py-5 text-center font-normal">
                  <span className="whitespace-nowrap text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Rouleau classique
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((feature, i) => {
                const isLast = i === ROWS.length - 1;
                const rowBorder = isLast ? "" : "border-b border-black/[0.04]";
                return (
                  <tr key={feature} className={revealClass(visible, i + 3)}>
                    <th scope="row" className={`px-8 py-5 text-[15px] font-medium text-foreground ${rowBorder}`}>
                      {feature}
                    </th>
                    <td className={`bg-volt/[0.05] px-4 py-5 text-center ${rowBorder}`}>
                      <div className="flex justify-center">
                        <CheckBadge visible={visible} step={i + 3} />
                      </div>
                    </td>
                    <td className={`px-4 py-5 text-center ${rowBorder}`}>
                      <span aria-hidden="true" className="text-base font-medium text-muted-foreground/50">
                        —
                      </span>
                      <span className="sr-only">Non inclus</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile / small-tablet: two stacked cards — VOLREP (accented)
            then Standard Roller (muted) — rather than a shrunk table. */}
        <div className="mx-auto mt-12 flex max-w-md flex-col gap-3 lg:hidden">
          <div
            className={`rounded-[24px] border border-volt/15 border-t-[3px] border-t-volt bg-volt/[0.04] p-6 ${revealClass(visible, 2)}`}
          >
            <div className="flex flex-col items-start gap-2">
              <FeaturedThumbnail image={product.featuredImage} />
              <VolrepLabel />
            </div>
            <ul className="mt-5 flex flex-col gap-4">
              {ROWS.map((feature, i) => (
                <li key={feature} className={`flex items-center gap-3 text-[15px] font-medium text-foreground ${revealClass(visible, i + 3)}`}>
                  <CheckBadge visible={visible} step={i + 3} />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div aria-hidden="true" className="flex items-center justify-center py-1">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60">vs</span>
          </div>

          <div className={`rounded-[24px] border border-black/[0.06] bg-white p-6 ${revealClass(visible, 3)}`}>
            <span className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Rouleau classique</span>
            <ul className="mt-5 flex flex-col gap-4">
              {ROWS.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-[15px] font-medium text-muted-foreground/70">
                  <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center text-base font-medium text-muted-foreground/50">
                    —
                  </span>
                  {feature}
                  <span className="sr-only">Non inclus</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
