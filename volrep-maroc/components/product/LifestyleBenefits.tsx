"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

// Reused from RecoveryPhilosophy.tsx's own hero background — the one asset
// in the Shopify Files library that actually shows the VOLREP PRM™ in use
// (resting hands-free under a calf) rather than a generic fitness model
// with no product in frame. Swapped in for that reason: this section's
// whole job is "show the product working," and the previous asset
// (Back-recovery.webp, still used by RecoverEverywhere's pain-point tiles)
// didn't have the product in the shot at all.
const LIFESTYLE_IMAGE_URL = "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/VOLREP-Section-3-Background.webp";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconTarget() {
  return (
    <svg {...ICON_PROPS} className="h-[52px] w-[52px] lg:h-11 lg:w-11">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg {...ICON_PROPS} className="h-[52px] w-[52px] lg:h-11 lg:w-11">
      <path d="M2 12h4l1.5-4 3 8 2-10 1.5 6H22" />
    </svg>
  );
}

function IconBattery() {
  return (
    <svg {...ICON_PROPS} className="h-[52px] w-[52px] lg:h-11 lg:w-11">
      <rect x="2.5" y="7" width="16" height="10" rx="2.5" />
      <path d="M20.5 10.2v3.6" />
      <rect x="5" y="9.5" width="9" height="5" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconQuiet() {
  return (
    <svg {...ICON_PROPS} className="h-[52px] w-[52px] lg:h-11 lg:w-11">
      <path d="M4 9.5v5h3l5 4v-13l-5 4H4Z" />
      <path d="M16.8 10a3.2 3.2 0 0 1 0 4" />
    </svg>
  );
}

type Benefit = {
  title: string;
  description: string;
  icon: ReactNode;
};

const BENEFITS: Benefit[] = [
  {
    title: "Percussion de précision",
    description: "Quatre embouts interchangeables offrent un soulagement ciblé exactement là où se logent les tensions.",
    icon: <IconTarget />,
  },
  {
    title: "Récupération plus rapide",
    description: "Stimule la circulation et soulage les courbatures après chaque séance.",
    icon: <IconPulse />,
  },
  {
    title: "Autonomie toute la journée",
    description: "Conception sans fil offrant plusieurs heures d’autonomie, prête dès que vous l’êtes.",
    icon: <IconBattery />,
  },
  {
    title: "Moteur ultra-silencieux",
    description: "Récupérez à votre rythme sans déranger votre entourage.",
    icon: <IconQuiet />,
  },
];

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below. Same
// pattern as WhyVolrep/RecoveryPhilosophy/RecoverEverywhere on the
// homepage — this scroll-reveal boilerplate is intentionally duplicated
// per-section rather than shared, per the existing site convention.
const REVEAL_DELAYS = ["delay-0", "delay-100", "delay-200", "delay-300", "delay-500", "delay-700", "delay-1000"];
// Card stagger per spec: 0ms / 120ms / 240ms / 360ms.
const CARD_DELAYS = ["delay-[0ms]", "delay-[120ms]", "delay-[240ms]", "delay-[360ms]"];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;
}

function cardRevealClass(visible: boolean, index: number) {
  const delay = CARD_DELAYS[Math.min(index, CARD_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;
}

// Sits directly below ProductHero on the product page: a lifestyle shot +
// headline/copy pair, followed by a 4-up benefit grid. Mirrors the
// homepage's established premium-section language (uppercase display
// headline, WhyVolrep's exact card recipe) rather than introducing a new
// visual system, and shares ProductHero's own <PageContainer> (1440px) so
// the two sections' left/right edges land pixel-identical rather than each
// section picking its own width.
export function LifestyleBenefits() {
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
    <section
      ref={sectionRef}
      aria-labelledby="lifestyle-benefits-heading"
      // py-12 lg:py-14 is the shared section-rhythm token (see ProductHero's
      // matching pb-12 lg:pb-14): two adjacent sections each contributing
      // their half combine to a 96px (mobile/tablet) or 112px (desktop) gap
      // — within the requested 96-120px band, and reused as one number
      // rather than tuned per-section.
      className="bg-background py-12 lg:py-14"
    >
      <PageContainer>
        {/* Even split (1fr/1fr), not image-led 60/40 or 55/45: at
            1024-1279px specifically, the container is still
            viewport-capped rather than sitting at the full 1440px
            ceiling, and an image-dominant split leaves too narrow a text
            column for "Recover Better." to hold one line at any headline
            size worth calling a headline. Verified by measuring actual
            rendered line counts across 1024-1920px, not assumed — an
            image-led split only stays safe from ~1366px up. */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div
            className={`relative aspect-[4/3] overflow-hidden rounded-[30px] shadow-[0_32px_70px_-32px_rgba(11,11,11,0.18)] sm:aspect-[16/10] ${revealClass(visible, 0)}`}
          >
            <Image
              src={LIFESTYLE_IMAGE_URL}
              alt="Une personne récupérant mains libres, le mollet posé sur le rouleau à percussion VOLREP PRM™"
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover object-right"
            />
          </div>

          <div>
            <p className={`flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground ${revealClass(visible, 0)}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
              VOLREP<span aria-hidden="true">™</span> / Performance
            </p>

            <h2
              id="lifestyle-benefits-heading"
              className={`mt-9 text-[1.75rem] uppercase leading-[0.94] tracking-[-0.02em] text-foreground sm:text-[2.375rem] lg:text-[2rem] xl:text-[2.875rem] ${revealClass(visible, 1)}`}
            >
              Mieux récupérer.
              <br />
              Performer plus fort.
            </h2>

            <p className={`mt-12 max-w-[480px] text-base leading-relaxed text-muted-foreground sm:text-lg ${revealClass(visible, 2)}`}>
              Intégré à votre routine quotidienne, pas en marge de celle-ci. Le VOLREP PRM™ transforme quelques
              minutes de calme en une récupération plus profonde, pour que chaque entraînement, chaque journée de
              travail et chaque jour de repos travaillent pour vous plutôt que contre vous.
            </p>
          </div>
        </div>

        {/* Plain, generous gap below the image+copy row — no overlap. A
            layered/overlapping card row was tried and reverted: it read as
            heavier and more "trick," not more premium. Whitespace alone
            carries the separation here. */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
          {BENEFITS.map((benefit, i) => (
            <div
              key={benefit.title}
              className={`group flex min-h-[264px] flex-col justify-between rounded-[28px] border border-black/[0.06] bg-white p-9 transition-all duration-[250ms] ease-out hover:-translate-y-1.5 hover:border-black/[0.14] hover:shadow-[0_18px_44px_-16px_rgba(11,11,11,0.14)] lg:p-10 ${cardRevealClass(visible, i)}`}
            >
              <div>
                <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-muted lg:h-16 lg:w-16">
                  <div className="text-foreground transition-colors duration-[250ms] ease-out group-hover:text-volt">
                    {benefit.icon}
                  </div>
                </div>

                <h3 className="mt-7 text-xl font-bold leading-tight text-foreground sm:text-2xl">{benefit.title}</h3>
                <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}
