"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Container } from "@/components/layout/Container";
import type { TestimonialsSectionData } from "@/lib/homepage/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Testimonials({ data }: { data: TestimonialsSectionData }) {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsWrapperRef = useRef<HTMLDivElement>(null);
  const trustLogosRef = useRef<HTMLDivElement>(null);
  const trustWrapperRef = useRef<HTMLDivElement>(null);
  const [heading1, heading2] = data.heading.split("\n");

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;

      if (headerRef.current) {
        gsap.from(headerRef.current, {
          opacity: 0,
          y: 28,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: headerRef.current, start: "top 80%" },
        });
      }

      const cards = gsap.utils.toArray<HTMLElement>(".testimonial-card");
      if (cards.length) {
        gsap.from(cards, {
          opacity: 0,
          y: 32,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.15,
          // GSAP's inline styles otherwise outrank the CSS hover:-translate-y-2
          // utility indefinitely (inline beats class specificity), so the lift
          // would silently stop working the moment a card finishes revealing.
          // clearProps hands the property back to CSS once the tween is done;
          // the transition-transform class (added here, not up front) keeps
          // that hand-off from fighting this reveal tween's own inline writes.
          clearProps: "all",
          onComplete: () => cards.forEach((card) => card.classList.add("transition-transform")),
          scrollTrigger: { trigger: cardsWrapperRef.current, start: "top 85%" },
        });
      }

      if (trustLogosRef.current) {
        gsap.from(trustLogosRef.current, {
          opacity: 0,
          y: 16,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: { trigger: trustLogosRef.current, start: "top 90%" },
        });
      }

      const trustItems = gsap.utils.toArray<HTMLElement>(".trust-item");
      if (trustItems.length) {
        gsap.from(trustItems, {
          opacity: 0,
          y: 18,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: { trigger: trustWrapperRef.current, start: "top 90%" },
        });
      }
    },
    { scope: sectionRef },
  );

  return (
    <section ref={sectionRef} aria-labelledby="testimonials-heading" className="relative bg-background py-16 sm:py-20 lg:py-24">
      <Container>
        <div ref={headerRef} className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            VOLREP<span aria-hidden="true">™</span> / {data.eyebrow}
          </p>

          <h2
            id="testimonials-heading"
            className="mt-5 text-3xl uppercase leading-[1] tracking-[-0.02em] text-foreground sm:text-4xl lg:text-[2.5rem]"
          >
            {heading1}
            {heading2 !== undefined && (
              <>
                <br />
                {heading2}
              </>
            )}
          </h2>

          <p className="mx-auto mt-8 max-w-[600px] text-sm text-muted-foreground sm:text-base">
            {data.body}
          </p>

          <div className="mt-9 flex flex-col items-center gap-2">
            <span aria-hidden="true" className="text-lg tracking-[0.2em] text-gold">
              {data.rating.stars}
            </span>
            <span className="sr-only">Noté 4,9 sur 5 étoiles</span>
            <span className="text-sm font-semibold text-foreground">{data.rating.label}</span>
            <span className="text-xs text-muted-foreground">{data.rating.description}</span>
          </div>
        </div>

        <div ref={cardsWrapperRef} className="mt-10 sm:mt-12 lg:mt-14">
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0">
            {data.cards.map((testimonial) => (
              <div
                key={testimonial.name}
                className="testimonial-card flex min-h-[420px] w-full shrink-0 snap-center flex-col rounded-[20px] border border-black/[0.06] bg-white p-10 text-left shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] duration-[350ms] ease-out hover:-translate-y-2 hover:border-volt/25 hover:shadow-[0_24px_60px_-12px_rgba(55,143,253,0.12)] sm:w-[47%] lg:min-h-[400px] lg:w-auto lg:shrink lg:snap-align-none"
              >
                <div
                  aria-hidden="true"
                  className="flex h-20 w-20 items-center justify-center rounded-full border border-black/[0.06] bg-muted text-base font-semibold text-muted-foreground lg:h-16 lg:w-16 lg:text-sm"
                >
                  {getInitials(testimonial.name)}
                </div>

                <span aria-hidden="true" className="mt-6 text-base tracking-[0.2em] text-gold">
                  ★★★★★
                </span>
                <span className="sr-only">Noté 5 sur 5 étoiles</span>

                <p className="mt-6 max-w-[38ch] text-xl font-medium leading-[1.6] text-foreground lg:text-[18px] lg:leading-[1.65]">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>

                <div className="mt-auto pt-8">
                  <p className="text-[16px] font-semibold text-foreground">{testimonial.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-volt" />
                    {data.verifiedLabel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div ref={trustLogosRef} className="mt-12 flex flex-col items-center gap-3 text-center sm:mt-14">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-sm tracking-[0.15em] text-gold">
              ★★★★★
            </span>
            <span className="text-sm font-semibold text-foreground">{data.trustline.rating}</span>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{data.trustline.label}</p>
          <p className="text-sm text-muted-foreground">
            {data.trustline.audiences.map((audience, i) => (
              <span key={audience}>
                {i > 0 && (
                  <span aria-hidden="true" className="mx-2 text-muted-foreground/50">
                    •
                  </span>
                )}
                {audience}
              </span>
            ))}
          </p>
        </div>

        <div ref={trustWrapperRef} className="mt-12 grid grid-cols-2 gap-y-12 sm:mt-14 lg:grid-cols-4 lg:gap-y-0">
          {data.trustItems.map((item, i) => (
            <div
              key={item.label}
              className={`trust-item flex flex-col items-center px-6 text-center ${i > 0 ? "lg:border-l lg:border-black/[0.06]" : ""}`}
            >
              <span className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">{item.value}</span>
              <span className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
