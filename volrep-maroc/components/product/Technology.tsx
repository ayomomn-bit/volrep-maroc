"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import type { ShopifyProduct } from "@/lib/backend/products";

type TechCallout = {
  index: string;
  title: string;
  description: string;
};

const CALLOUTS: TechCallout[] = [
  {
    index: "01",
    title: "Rouleaux 4D",
    description: "Un contact ciblé conçu pour épouser les contours de vos muscles.",
  },
  {
    index: "02",
    title: "Conception ergonomique",
    description: "Pensé pour accompagner naturellement les mouvements de votre corps pendant la récupération.",
  },
  {
    index: "03",
    title: "Récupération mains libres",
    description: "Utilisez le poids de votre corps pour une expérience de récupération naturelle.",
  },
];

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below. Same
// duplicated scroll-reveal pattern used throughout the site (HowItWorks,
// LifestyleBenefits, UgcShowcase).
const REVEAL_DELAYS = ["delay-0", "delay-150", "delay-300", "delay-500"];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`;
}

type CalloutBlockProps = {
  callout: TechCallout;
  visible: boolean;
  delayIndex: number;
  align: "left" | "right";
};

// One annotation: a hairline "tick" that draws in on scroll (the spec's
// "subtle line-draw animation") standing in for a literal leader line to
// the product — pointing an SVG line at exact product-photo geometry would
// be precise for one image and wrong the moment that asset is replaced.
function CalloutBlock({ callout, visible, delayIndex, align }: CalloutBlockProps) {
  const delay = REVEAL_DELAYS[Math.min(delayIndex, REVEAL_DELAYS.length - 1)];
  const isRight = align === "right";

  return (
    <div
      className={`flex flex-col gap-3 transition-all duration-700 ease-out ${delay} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${isRight ? "items-end text-right" : "items-start text-left"}`}
    >
      <span
        aria-hidden="true"
        className={`h-px w-8 bg-paper/25 transition-transform duration-700 ease-out ${isRight ? "origin-right" : "origin-left"} ${
          visible ? "scale-x-100" : "scale-x-0"
        }`}
      />
      <div className={`flex items-baseline gap-2.5 ${isRight ? "flex-row-reverse" : ""}`}>
        <span aria-hidden="true" className="text-xs font-medium text-volt">
          {callout.index}
        </span>
        <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-paper">{callout.title}</h3>
      </div>
      <p className="max-w-[230px] text-sm leading-relaxed text-paper/55">{callout.description}</p>
    </div>
  );
}

// "Why VOLREP PRM™" / Technology showcase — deep-black, editorial, product-
// first section. Reuses the product's own Shopify featuredImage (an
// already-isolated cutout with a transparent background — see its own
// comment below) rather than a new asset, per the brief's "do not invent a
// new product image."
export function Technology({ product }: { product: ShopifyProduct }) {
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

  // The Shopify featuredImage for this product is already a background-
  // removed (transparent PNG) cutout — the same asset ProductGallery shows
  // first — so it drops straight onto this section's flat #0B0B0B background
  // with no visible image edge, reading as fully isolated. The source canvas
  // itself has generous transparent padding around the (diagonally framed)
  // product though — left/right margins measured at ~6%/8%, top/bottom at
  // ~18%/22% — so object-contain alone left the product looking small inside
  // its box. The aspect-[4/3] + object-cover pairing below crops into that
  // margin (more off the top/bottom, where there was room to spare, than
  // left/right, where the product sits closer to the edge) without clipping
  // any part of the product itself.
  const image = product.featuredImage;

  return (
    <section ref={sectionRef} aria-labelledby="technology-heading" className="bg-ink py-16 sm:py-20 lg:py-24">
      <PageContainer>
        <div className="mx-auto max-w-2xl text-center">
          <p
            className={`flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-paper/60 ${revealClass(visible, 0)}`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            VOLREP PRM<span aria-hidden="true">™</span> / Technologie
          </p>

          <h2
            id="technology-heading"
            className={`mt-5 text-5xl uppercase leading-[0.92] tracking-[-0.03em] text-paper sm:text-6xl lg:text-7xl ${revealClass(visible, 1)}`}
          >
            Une ingénierie différente.
          </h2>

          <p
            className={`mx-auto mt-5 max-w-[480px] text-base leading-relaxed text-paper/60 sm:text-lg ${revealClass(visible, 2)}`}
          >
            Conçu autour de la façon dont votre corps bouge, le PRM<span aria-hidden="true">™</span> réunit pression
            ciblée, conception ergonomique et récupération mains libres en un seul système.
          </p>
        </div>

        {/* Desktop / large-tablet composition: product dead-center and
            dominant, callouts pulled in close on either side — matches the
            brief's ASCII layout. Hidden below lg rather than reflowed, per
            "do not simply shrink the desktop layout" — mobile gets its own
            stacked composition below. The product column (2fr vs. 1fr per
            side) and object-cover crop below both exist to make the product
            read as the section's visual anchor, not a small centered icon. */}
        <div className="mt-10 hidden lg:block">
          <div className="grid grid-cols-[1fr_2fr_1fr] items-center gap-x-8">
            <div className="flex justify-start">
              <CalloutBlock callout={CALLOUTS[0]} visible={visible} delayIndex={2} align="left" />
            </div>

            <div
              className={`relative aspect-[4/3] w-full overflow-hidden transition-all duration-1000 ease-out ${
                visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
              }`}
            >
              {image && (
                <Image
                  src={image.url}
                  alt={image.altText ?? product.title}
                  fill
                  sizes="(min-width: 1024px) 56vw, 80vw"
                  className="object-cover"
                />
              )}
            </div>

            <div className="flex flex-col items-end gap-8">
              <CalloutBlock callout={CALLOUTS[1]} visible={visible} delayIndex={2} align="right" />
              <CalloutBlock callout={CALLOUTS[2]} visible={visible} delayIndex={3} align="right" />
            </div>
          </div>
        </div>

        {/* Mobile / tablet composition: eyebrow/headline/description (shared
            block above) → product → a simple indexed list, per spec. */}
        <div className="mt-8 lg:hidden">
          <div
            className={`relative mx-auto aspect-[4/3] w-full max-w-[480px] overflow-hidden transition-all duration-1000 ease-out ${
              visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            {image && (
              <Image src={image.url} alt={image.altText ?? product.title} fill sizes="100vw" className="object-cover" />
            )}
          </div>

          <ul className="mx-auto mt-6 flex max-w-[480px] flex-col divide-y divide-paper/10 sm:mt-8">
            {CALLOUTS.map((callout, i) => (
              <li key={callout.index} className={`flex gap-4 py-5 first:pt-0 ${revealClass(visible, i + 2)}`}>
                <span aria-hidden="true" className="text-xs font-medium text-volt">
                  {callout.index}
                </span>
                <div>
                  <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-paper">{callout.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-paper/55">{callout.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </PageContainer>
    </section>
  );
}
