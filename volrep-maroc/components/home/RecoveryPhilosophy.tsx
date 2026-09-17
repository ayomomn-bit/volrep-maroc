"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import type { RecoveryPhilosophySectionData } from "@/lib/homepage/types";

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below.
const REVEAL_DELAYS = ["delay-0", "delay-100", "delay-200", "delay-300"];

function revealClass(visible: boolean, step: number) {
  return `${REVEAL_DELAYS[step]} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;
}

// The homepage's single Volt Blue storytelling block. The section fill is the
// brand primary (#378FFD via --volt); the athlete photograph is kept — no
// longer a full-bleed backdrop but an integrated right-half (desktop) / lower
// band (mobile) panel, edge-blended into the blue so the two read as one
// composition. --volt-deep (a darkened step of --volt, not a second brand
// colour) provides a directional wash that lifts white-text contrast on the
// copy side. Deliberately the only large blue surface on the page — the final
// CTA section stays black.
export function RecoveryPhilosophy({ data }: { data: RecoveryPhilosophySectionData }) {
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
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="recovery-philosophy-heading"
      className="relative isolate overflow-hidden bg-volt"
    >
      <Container className="relative z-10">
        <div
          className={`max-w-[440px] py-14 sm:py-20 lg:flex lg:min-h-[720px] lg:max-w-[480px] lg:flex-col lg:justify-center lg:py-28 lg:pr-10 ${revealClass(visible, 0)}`}
        >
          <p
            className={`flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/70 ${revealClass(visible, 0)}`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white" />
            VOLREP<span aria-hidden="true">™</span> / {data.eyebrow}
          </p>

          <h2
            id="recovery-philosophy-heading"
            className={`mt-5 text-4xl uppercase leading-[0.95] tracking-[-0.035em] text-white sm:text-5xl lg:text-[3.25rem] ${revealClass(visible, 1)}`}
          >
            {heading1}
            {heading2 !== undefined && (
              <>
                <br />
                {heading2}
              </>
            )}
          </h2>

          <p
            className={`mt-6 max-w-[420px] text-base leading-relaxed text-white/85 sm:text-lg ${revealClass(visible, 2)}`}
          >
            {data.body}
          </p>

          <div className={`mt-8 ${revealClass(visible, 3)}`}>
            <ButtonLink
              href={data.cta.href}
              variant="light"
              size="lg"
              className="w-full sm:w-auto"
            >
              {data.cta.label}
            </ButtonLink>
          </div>
        </div>
      </Container>

      {/* Athlete photograph — full-width band beneath the copy on mobile, the
          right ~56% on desktop. Kept as-is; the Volt tint + feather overlay
          below sit ON TOP of it so its inner edge melts into the fill instead
          of butting against it as a hard seam. */}
      <div className="relative h-[280px] w-full sm:h-[360px] lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-[56%]">
        {data.background.url && (
          <Image
            src={data.background.url}
            alt={data.background.alt}
            fill
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="recovery-bg-zoom object-cover object-[64%_28%]"
          />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-volt/15 mix-blend-multiply" />
      </div>

      {/* Blue feather + copy-side contrast wash. Painted after the photo so it
          overlaps the photo's inner edge; the copy (z-10) stays above it.
          Vertical on mobile (copy above the photo band), horizontal on
          desktop (copy left of the photo). Every stop is --volt / --volt-deep
          — no second colour is introduced. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-volt-deep/85 from-0% via-volt/60 via-45% to-transparent to-65% sm:bg-gradient-to-r lg:via-volt/90 lg:via-46% lg:to-transparent lg:to-78%"
      />
    </section>
  );
}
