"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import type { FinalCtaIcon, FinalCtaSectionData } from "@/lib/homepage/types";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconTruck() {
  return (
    <svg {...ICON_PROPS} className="h-4 w-4">
      <path d="M2.5 6.5h10v8h-10z" />
      <path d="M12.5 10h4l3.5 3.5v1h-7.5z" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg {...ICON_PROPS} className="h-4 w-4">
      <path d="M12 3.5 18.5 6v5.2c0 4.35-2.73 8.02-6.5 9.3-3.77-1.28-6.5-4.95-6.5-9.3V6L12 3.5Z" />
    </svg>
  );
}

function IconReturn() {
  return (
    <svg {...ICON_PROPS} className="h-4 w-4">
      <path d="M4 4v5h5" />
      <path d="M4.5 9a8 8 0 1 1 1.7 8.4" />
    </svg>
  );
}

const BADGE_ICONS: Record<FinalCtaIcon, ReactNode> = {
  truck: <IconTruck />,
  shield: <IconShield />,
  return: <IconReturn />,
};

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below.
const REVEAL_DELAYS = ["delay-0", "delay-100", "delay-200", "delay-300", "delay-500", "delay-700", "delay-1000"];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;
}

export function FinalCTA({ data }: { data: FinalCtaSectionData }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [heading1, heading2] = data.heading.split("\n");

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
      aria-labelledby="final-cta-heading"
      className="relative overflow-hidden border-b border-white/[0.08] pt-16 pb-10 sm:pt-20 sm:pb-14 lg:pt-24 lg:pb-16"
      // rgba(55,143,253,...) is the app's --volt brand blue (#378FFD) in
      // raw-rgba form (needed here for the alpha fade; the CSS var itself is
      // a plain hex). Kept byte-for-byte in sync with the --volt token and
      // the product page's --primary so every "brand blue" on the site
      // resolves to one value.
      style={{
        background: "radial-gradient(circle at center, rgba(55,143,253,0.12) 0%, transparent 45%), #070707",
      }}
    >
      <Container className="relative">
        <div className={`mx-auto max-w-[900px] text-center ${revealClass(visible, 0)}`}>
          <p className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-paper/60">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            VOLREP<span aria-hidden="true">™</span> / {data.eyebrow}
          </p>

          <h2
            id="final-cta-heading"
            className={`mt-6 text-4xl font-bold uppercase leading-[0.98] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.25rem] ${revealClass(visible, 1)}`}
          >
            {heading1}
            {heading2 !== undefined && (
              <>
                <br />
                {heading2}
              </>
            )}
          </h2>

          <p className={`mx-auto mt-9 max-w-[650px] text-sm text-paper/60 sm:text-base ${revealClass(visible, 2)}`}>
            {data.body}
          </p>

          <div
            className={`mx-auto mt-12 flex w-full max-w-xs flex-col items-center justify-center gap-6 sm:max-w-none sm:flex-row sm:gap-8 ${revealClass(visible, 3)}`}
          >
            <Link
              href={data.primaryCta.href}
              className="inline-flex h-14 w-full items-center justify-center rounded-full bg-volt px-9 text-base font-semibold text-white transition-all duration-[350ms] ease-out hover:scale-[1.03] hover:bg-volt-deep hover:shadow-[0_20px_50px_-10px_rgba(55,143,253,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:w-auto"
            >
              {data.primaryCta.label}
            </Link>

            <Link
              href={data.secondaryCta.href}
              className="group inline-flex items-center gap-2 text-base font-semibold text-white opacity-75 transition-opacity duration-300 ease-out hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
            >
              {data.secondaryCta.label}
              <span aria-hidden="true" className="transition-transform duration-300 ease-out group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>

          <div className={`mt-10 flex items-center justify-center gap-2 ${revealClass(visible, 4)}`}>
            <span aria-hidden="true" className="text-sm tracking-[0.15em] text-gold">
              {data.rating.stars}
            </span>
            <span className="sr-only">Noté 4,9 sur 5 étoiles</span>
            <span className="text-sm font-medium text-paper/70">{data.rating.label}</span>
          </div>

          <div
            className={`mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 ${revealClass(visible, 5)}`}
          >
            {data.badges.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-paper/60">
                {BADGE_ICONS[badge.icon]}
                <span className="text-xs font-medium uppercase tracking-[0.1em]">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
