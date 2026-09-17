"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/layout/Container";
import type { FaqItemData, FaqSectionData } from "@/lib/homepage/types";

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below.
const REVEAL_DELAYS = ["delay-0", "delay-100", "delay-200", "delay-300", "delay-500", "delay-700", "delay-1000"];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;
}

function FaqAccordionItem({
  item,
  index,
  isOpen,
  onToggle,
  visible,
}: {
  item: FaqItemData;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  visible: boolean;
}) {
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-button-${index}`;

  return (
    <div
      className={`overflow-hidden rounded-[18px] border bg-white transition-colors duration-300 ease-out ${
        isOpen ? "border-volt/40" : "border-black/[0.06]"
      } ${revealClass(visible, index + 2)}`}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-7 text-left transition-colors duration-300 ease-out hover:bg-black/[0.02] sm:gap-6 sm:px-8 lg:py-6"
        >
          <span className="min-w-0 flex-1 text-[18px] font-semibold text-foreground">{item.question}</span>

          <span
            aria-hidden="true"
            className={`relative flex h-4 w-4 shrink-0 items-center justify-center transition-colors duration-300 ease-out ${
              isOpen ? "text-volt" : "text-foreground"
            }`}
          >
            <span className="absolute h-px w-4 bg-current" />
            <span
              className={`absolute h-4 w-px bg-current transition-transform duration-300 ease-out ${isOpen ? "rotate-90" : "rotate-0"}`}
            />
          </span>
        </button>
      </h3>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-6 text-base leading-relaxed text-muted-foreground sm:px-8">{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQ({ data }: { data: FaqSectionData }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(data.defaultOpen >= 0 ? data.defaultOpen : null);

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
      aria-labelledby="faq-heading"
      className="bg-background pt-16 pb-16 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-24"
    >
      <Container>
        <div className={`mx-auto max-w-[700px] text-center ${revealClass(visible, 0)}`}>
          <p className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            VOLREP<span aria-hidden="true">™</span> / {data.eyebrow}
          </p>

          <h2
            id="faq-heading"
            className="mt-5 text-3xl uppercase leading-[1] tracking-[-0.02em] text-foreground sm:text-4xl lg:text-[2.5rem]"
          >
            {data.heading}
          </h2>

          <p className="mt-6 text-sm text-muted-foreground sm:text-base">
            {data.subtitle}
          </p>
        </div>

        <div className="mx-auto mt-10 flex max-w-[900px] flex-col gap-4 sm:mt-12 lg:mt-14">
          {data.items.map((item, index) => (
            <FaqAccordionItem
              key={item.question}
              item={item}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex((prev) => (prev === index ? null : index))}
              visible={visible}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
