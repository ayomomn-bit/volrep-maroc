"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/layout/Container";
import type { NewsletterSectionData } from "@/lib/homepage/types";

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below.
const REVEAL_DELAYS = ["delay-0", "delay-100", "delay-200", "delay-300", "delay-500"];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;
}

// Headline gets an extra "slight blur reveal" on top of the usual fade-up.
function revealClassBlur(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${
    visible ? "translate-y-0 opacity-100 blur-none" : "translate-y-6 opacity-0 blur-sm"
  }`;
}

export function Newsletter({ data }: { data: NewsletterSectionData }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
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

  // No email service is wired up yet (Klaviyo/Shopify customer API/etc.) —
  // this only acknowledges the submission locally until that's connected.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section ref={sectionRef} aria-labelledby="newsletter-heading" className="bg-[#F8F7F3]">
      {/* Same shared <Container> every other section uses (not a bespoke
          max-w-[1200px] wrapper) — keeps this section's left/right edges on
          the site's one content grid instead of its own one-off width. */}
      <Container className="pt-10 pb-8 sm:pt-14 sm:pb-8 lg:pt-16 lg:pb-10">
        <div className="mx-auto max-w-xl text-center">
          <p className={`flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground ${revealClass(visible, 0)}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            VOLREP<span aria-hidden="true">™</span> / {data.eyebrow}
          </p>

          <h2
            id="newsletter-heading"
            className={`mt-6 text-4xl font-bold uppercase leading-[0.98] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-[3.25rem] ${revealClassBlur(visible, 1)}`}
          >
            {heading1}
            {heading2 !== undefined && (
              <>
                <br />
                {heading2}
              </>
            )}
          </h2>

          <p className={`mx-auto mt-7 max-w-[520px] text-sm text-muted-foreground sm:text-base ${revealClass(visible, 2)}`}>
            {data.body}
          </p>

          {submitted ? (
            <p className={`mt-10 text-sm font-medium text-foreground ${revealClass(visible, 3)}`} role="status">
              {data.successMessage}
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className={`mx-auto mt-10 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row sm:gap-4 ${revealClass(visible, 3)}`}
            >
              <label htmlFor="newsletter-email" className="sr-only">
                {data.emailLabel}
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={data.emailPlaceholder}
                className="h-[60px] w-full rounded-full border border-black/[0.08] bg-white px-6 text-sm text-foreground outline-none transition-colors duration-300 ease-out placeholder:text-muted-foreground focus:border-volt sm:w-[420px]"
              />

              <button
                type="submit"
                className="inline-flex h-[60px] w-full items-center justify-center rounded-full bg-ink px-9 text-base font-semibold text-paper transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              >
                {data.submitLabel}
              </button>
            </form>
          )}
        </div>

        <div className="mt-10 border-t border-black/[0.06] sm:mt-12" />
      </Container>
    </section>
  );
}
