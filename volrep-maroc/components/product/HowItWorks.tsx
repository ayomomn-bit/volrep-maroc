"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";

// Same asset LifestyleBenefits uses — still the only photo in the Shopify
// Files library that actually shows the VOLREP PRM™ in hands-free use
// (resting under a calf), which is the literal brief for this section's
// image too. Re-shown here in a completely different, full-bleed/cinematic
// treatment rather than the rounded "floating card" from that section, so
// the repetition reads as a deliberate motif (this is how the product is
// used) rather than a duplicate asset.
const LIFESTYLE_IMAGE_URL = "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/VOLREP-Section-3-Background.webp";

type Step = {
  number: string;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Positionnez le PRM™",
    description: "Placez le rouleau sous le muscle que vous souhaitez cibler.",
  },
  {
    number: "02",
    title: "Détendez-vous et roulez",
    description: "Utilisez le poids de votre corps en roulant lentement pendant 60 à 90 secondes.",
  },
  {
    number: "03",
    title: "Récupérez plus vite",
    description: "Réduisez les courbatures et améliorez la circulation après chaque séance.",
  },
];

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below. Same
// duplicated scroll-reveal pattern used throughout the site.
const REVEAL_DELAYS = ["delay-0", "delay-100", "delay-200", "delay-300", "delay-500"];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;
}

// Full-bleed, black (#0B0B0B / bg-ink) editorial split — no cards, no
// icons. Mirrors RecoveryPhilosophy's dark full-bleed language from the
// homepage (same image asset, same text-paper/70 eyebrow convention)
// rather than reusing LifestyleBenefits' white-card system, since the
// brief here is explicitly "not feature cards."
//
// The left image is a *true* viewport-edge bleed, not just full-width
// within <PageContainer> — it sits outside the container as an absolutely
// positioned sibling, sized to calc(50vw - half the grid gap). That width
// isn't arbitrary: because <PageContainer> is always symmetric (equal
// left/right padding, mx-auto), its horizontal center sits at exactly 50vw
// at every viewport width, capped or not — so the gap between two equal
// grid columns inside it is also always centered on 50vw. Sizing the bleed
// image to stop exactly at that point means its right edge lines up with
// the grid gap with no gap-counting or breakpoint-specific fudging, and the
// text column (rendered normally inside the grid) still keeps this
// section's right edge pixel-identical to every other section's.
export function HowItWorks() {
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
    <section ref={sectionRef} aria-labelledby="how-it-works-heading" className="relative overflow-hidden bg-ink">
      {/* True edge-to-edge bleed, lg+ only — see file comment for the
          calc(50vw - gap/2) math (gap-16 = 4rem, half = 2rem — matches
          LifestyleBenefits' own lg:gap-16 above it, so both sections'
          text columns start at the exact same x, not just their outer
          <PageContainer> edges). Hidden below lg, where the columns stack
          and a plain inline image (below) takes over instead. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[calc(50vw-2rem)] lg:block">
        <Image
          src={LIFESTYLE_IMAGE_URL}
          alt="Une personne récupérant mains libres, le mollet posé sur le rouleau à percussion VOLREP PRM™"
          fill
          sizes="50vw"
          className="object-cover object-right"
        />
      </div>

      <PageContainer>
        <div className="grid grid-cols-1 gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-0">
          {/* Mobile/tablet-only inline image — the bled version above
              replaces this entirely at lg+. */}
          <div className={`relative aspect-[4/3] overflow-hidden lg:hidden ${revealClass(visible, 0)}`}>
            <Image
              src={LIFESTYLE_IMAGE_URL}
              alt="Une personne récupérant mains libres, le mollet posé sur le rouleau à percussion VOLREP PRM™"
              fill
              sizes="100vw"
              className="object-cover object-right"
            />
          </div>

          {/* Empty spacer reserving the left grid column at lg+ — the
              actual visual is the absolutely positioned bleed image above,
              which paints behind this (transparent) cell. */}
          <div aria-hidden="true" className="hidden lg:block" />

          <div className="flex flex-col justify-center lg:py-24">
            <p className={`flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-paper/70 ${revealClass(visible, 0)}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
              Comment ça marche
            </p>

            <h2
              id="how-it-works-heading"
              // lg dips before xl on purpose — same fix as
              // LifestyleBenefits' headline: at 1024-1279px the text column
              // is only ~416px (viewport-capped container, 50/50 split),
              // too narrow for "3 Simple Steps." at a larger size without
              // wrapping to a 3rd line. Verified by measuring rendered line
              // counts from 1024-1920px, not assumed.
              className={`mt-6 text-4xl uppercase leading-[0.94] tracking-[-0.02em] text-paper sm:text-5xl lg:text-[2rem] xl:text-[2.875rem] ${revealClass(visible, 1)}`}
            >
              La récupération en
              <br />
              3 étapes simples.
            </h2>

            <p className={`mt-6 max-w-[420px] text-base leading-relaxed text-paper/70 sm:text-lg ${revealClass(visible, 2)}`}>
              Une routine simple et reproductible intégrée au rouleau lui-même — sans hésitation, sans réglage, juste
              une récupération régulière.
            </p>

            <ol className="mt-10 flex flex-col lg:mt-12">
              {STEPS.map((step, i) => (
                <li
                  key={step.number}
                  className={`flex gap-6 py-7 first:pt-0 ${i > 0 ? "border-t border-paper/10" : ""} ${revealClass(visible, 3)}`}
                >
                  <span aria-hidden="true" className="shrink-0 text-4xl font-bold leading-none tracking-tight text-paper/25 sm:text-5xl">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold leading-tight text-paper sm:text-xl">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-paper/70 sm:text-base">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
