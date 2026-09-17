"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import type { RecoverEverywhereSectionData } from "@/lib/homepage/types";

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below.
const REVEAL_DELAYS = ["delay-0", "delay-100", "delay-200", "delay-300", "delay-500", "delay-700", "delay-1000"];

function revealClass(visible: boolean, step: number) {
  return `${REVEAL_DELAYS[step]} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;
}

export function RecoverEverywhere({ data }: { data: RecoverEverywhereSectionData }) {
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
      aria-labelledby="recover-everywhere-heading"
      className="relative overflow-hidden bg-background py-16 sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 0%, var(--muted), transparent 70%)" }}
      />

      <Container className="relative">
        <div className={`mx-auto max-w-xl text-center ${revealClass(visible, 0)}`}>
          <h2
            id="recover-everywhere-heading"
            className="text-3xl uppercase leading-[1] tracking-[-0.02em] text-foreground sm:text-4xl lg:text-[2.5rem]"
          >
            <span className="inline-flex items-center gap-3">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-volt" />
              {heading1}
            </span>
            {heading2 !== undefined && (
              <>
                <br />
                {heading2}
              </>
            )}
          </h2>

          <p className={`mt-5 text-sm text-muted-foreground sm:text-base ${revealClass(visible, 1)}`}>
            {data.subtitle}
          </p>
        </div>

        <div className="mt-10 max-w-full sm:mt-12 lg:mt-14">
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid lg:grid-cols-6 lg:gap-6">
            {data.zones.map((zone, i) => (
              <Link
                key={zone.title}
                href={data.ctaHref}
                className={`group relative block h-[430px] w-[85%] shrink-0 snap-center overflow-hidden rounded-sm bg-ink transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-16px_rgba(11,11,11,0.35),0_0_40px_-12px_rgba(55,143,253,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-[380px] sm:w-auto sm:shrink sm:snap-align-none lg:h-[420px] ${zone.span} ${revealClass(visible, Math.min(i + 2, REVEAL_DELAYS.length - 1))}`}
              >
                {zone.media.url && (
                  <Image
                    src={zone.media.url}
                    alt={zone.media.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw"
                    className={`object-cover ${zone.objectPosition} transition-transform duration-500 ease-out group-hover:scale-[1.08]`}
                  />
                )}
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                  <p className="text-xl font-semibold tracking-tight text-paper transition-transform duration-500 ease-out group-hover:-translate-y-1 sm:text-2xl">
                    {zone.title}
                  </p>
                  <p className="mt-2 max-w-[26ch] text-sm leading-relaxed text-paper/70">{zone.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-paper">
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-500 ease-out group-hover:translate-x-1"
                    >
                      →
                    </span>
                    {data.ctaLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
