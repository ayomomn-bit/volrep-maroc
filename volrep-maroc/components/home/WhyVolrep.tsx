"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import type { WhyVolrepIcon, WhyVolrepSectionData, WhyVolrepStat } from "@/lib/homepage/types";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconShield() {
  return (
    <svg {...ICON_PROPS} className="h-10 w-10 lg:h-8 lg:w-8">
      <path d="M12 3.5 18.5 6v5.2c0 4.35-2.73 8.02-6.5 9.3-3.77-1.28-6.5-4.95-6.5-9.3V6L12 3.5Z" />
    </svg>
  );
}

function IconWave() {
  return (
    <svg {...ICON_PROPS} className="h-10 w-10 lg:h-8 lg:w-8">
      <path d="M3 12h3.2l2-6.5 3 13 2.4-9.5 1.6 3H21" />
    </svg>
  );
}

function IconSoundWave() {
  return (
    <svg {...ICON_PROPS} className="h-10 w-10 lg:h-8 lg:w-8">
      <path d="M3 10v4h3l4 4V6l-4 4H3Z" />
      <path d="M15.2 9.3c1.1.9 1.1 4.5 0 5.4" />
      <path d="M17.8 7.2c2.1 2 2.1 7.6 0 9.6" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg {...ICON_PROPS} className="h-10 w-10 lg:h-8 lg:w-8">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.4 2.4 5-5.4" />
    </svg>
  );
}

const FEATURE_ICONS: Record<WhyVolrepIcon, ReactNode> = {
  shield: <IconShield />,
  wave: <IconWave />,
  soundwave: <IconSoundWave />,
  check: <IconCheckCircle />,
};

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below.
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

function useCountUp(target: number, visible: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!visible) return;

    let start: number | null = null;
    let raf = 0;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible, target, duration]);

  return value;
}

function StatItem({ stat, visible, index }: { stat: WhyVolrepStat; visible: boolean; index: number }) {
  const count = useCountUp(stat.value, visible);

  return (
    <div
      className={`group flex flex-col items-center px-6 py-2 text-center ${
        index > 0 ? "lg:border-l lg:border-black/[0.06]" : ""
      } ${revealClass(visible, 6)}`}
    >
      <span className="text-5xl font-bold tracking-tight text-foreground transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:text-volt sm:text-6xl">
        {count}
        {stat.suffix}
      </span>
      <span className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</span>
    </div>
  );
}

export function WhyVolrep({ data }: { data: WhyVolrepSectionData }) {
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
    <section ref={sectionRef} aria-labelledby="why-volrep-heading" className="bg-background py-16 sm:py-20 lg:py-24">
      <Container>
        <div className={`relative isolate mx-auto max-w-xl text-center ${revealClass(visible, 0)}`}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-4 -inset-y-4 -z-10 sm:-inset-x-6 sm:-inset-y-6 lg:-inset-x-24 lg:-inset-y-16"
            style={{ background: "radial-gradient(ellipse 60% 65% at 50% 35%, rgba(55,143,253,0.05), transparent 70%)" }}
          />

          <p className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            VOLREP<span aria-hidden="true">™</span> / {data.eyebrow}
          </p>

          <h2
            id="why-volrep-heading"
            className={`mt-5 text-3xl uppercase leading-[1] tracking-[-0.02em] text-foreground sm:text-4xl lg:text-[2.5rem] ${revealClass(visible, 1)}`}
          >
            {heading1}
            {heading2 !== undefined && (
              <>
                <br />
                {heading2}
              </>
            )}
          </h2>

          <p className={`mt-7 text-sm text-muted-foreground sm:text-base ${revealClass(visible, 1)}`}>
            {data.subtitle}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:mt-12 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
          {data.features.map((feature, i) => (
            <div
              key={feature.number}
              className={`group flex min-h-[260px] cursor-pointer flex-col justify-between rounded-[20px] border border-black/[0.06] bg-white p-10 transition-all duration-[450ms] ease-out hover:-translate-y-2 hover:border-volt/30 hover:shadow-[0_18px_50px_rgba(55,143,253,0.08)] lg:p-9 ${cardRevealClass(visible, i)}`}
            >
              <div>
                <span className="text-[13px] font-bold tracking-[0.18em] text-volt">{feature.number}</span>

                <div className="mt-5 text-volt">
                  {FEATURE_ICONS[feature.icon]}
                </div>

                <h3 className="mt-5 text-[26px] font-bold leading-tight text-foreground sm:text-[32px]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-[17px] leading-[1.7] text-muted-foreground">{feature.description}</p>
              </div>

              <span
                aria-hidden="true"
                className="mt-8 inline-block text-xl text-foreground transition-transform duration-[450ms] ease-out group-hover:translate-x-1"
              >
                →
              </span>
            </div>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-2 gap-y-12 lg:mt-14 lg:grid-cols-4 lg:gap-y-0">
          {data.stats.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} visible={visible} index={i} />
          ))}
        </div>
      </Container>
    </section>
  );
}
