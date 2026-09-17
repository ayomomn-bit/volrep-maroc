"use client";

import { useEffect, useRef, useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";

type FaqItem = {
  question: string;
  answer: string;
};

// Every answer is grounded in facts already established elsewhere in this
// app — the Shopify product description ("Advanced 4D massage roller for
// full-body recovery"), HowItWorks' own "60-90 seconds" session guidance,
// Technology's "4D rollers / hands-free / body-weight pressure" language,
// and TrustBadges/Footer's already-shipped "30-Day Returns" / "2-Year
// Warranty" copy. Two notes on what's deliberately NOT here:
//
// - The brief's suggested "How long does the battery last?" question is
//   dropped as asked — this product has no battery. Every verified source
//   (HowItWorks, Technology, Comparison, BenefitsList, the Shopify
//   description itself) consistently describes a fully manual, hands-free,
//   body-weight-driven roller with no motor/battery anywhere. Answering
//   "battery life" would mean either inventing a duration (explicitly
//   forbidden) or answering a premise that isn't true of this product, so
//   it's replaced with the honest, better-grounded, and genuinely
//   differentiating question below instead ("Does it need batteries or
//   charging?" → no).
// - "Cleaning" and "what's included" are answered in general, non-specific
//   terms (damp cloth, no submerging; "ready to use, nothing to charge")
//   rather than inventing materials, certifications, or an accessory list
//   that isn't confirmed anywhere in the project.
const FAQS: FaqItem[] = [
  {
    question: "Comment fonctionne le VOLREP PRM™ ?",
    answer:
      "Le VOLREP PRM™ est un rouleau de massage 4D avancé conçu pour la récupération de tout le corps. Placez-le sous le muscle que vous souhaitez cibler, puis utilisez le poids de votre corps pour rouler lentement et appliquer une pression contrôlée.",
  },
  {
    question: "Qu’est-ce qui distingue le VOLREP PRM™ d’un rouleau en mousse classique ?",
    answer:
      "Ses rouleaux 4D profilés suivent la forme naturelle de vos muscles pour un contact plus ciblé qu’un simple cylindre, et sa conception mains libres vous permet de contrôler la pression avec le poids de votre corps plutôt qu’avec vos bras.",
  },
  {
    question: "Comment fonctionne la conception mains libres ?",
    answer:
      "Plutôt que de tenir un appareil, vous posez le muscle à travailler directement sur le VOLREP PRM™ et utilisez le poids de votre corps pour contrôler la pression — vos mains restent libres et vous pouvez vous détendre complètement à chaque séance.",
  },
  {
    question: "Sur quelles zones du corps puis-je utiliser le VOLREP PRM™ ?",
    answer:
      "Le VOLREP PRM™ est conçu pour une utilisation sur tout le corps, y compris les mollets, le dos, les jambes et les épaules.",
  },
  {
    question: "Combien de temps doit durer chaque séance de récupération ?",
    answer:
      "La plupart des séances ne durent que quelques minutes. Nous recommandons de rouler lentement pendant environ 60 à 90 secondes par groupe musculaire, puis d’ajuster selon vos sensations.",
  },
  {
    question: "Le VOLREP PRM™ convient-il à un usage quotidien ?",
    answer:
      "Oui. Le VOLREP PRM™ est conçu pour s’intégrer naturellement à une routine de récupération quotidienne, que ce soit avant une séance de sport, après, ou simplement en fin de journée.",
  },
  {
    question: "Le VOLREP PRM™ nécessite-t-il des piles ou une recharge ?",
    answer:
      "Non. Le VOLREP PRM™ est un rouleau de récupération mécanique et mains libres : il n’y a aucune batterie à recharger.",
  },
  {
    question: "Comment nettoyer et entretenir le PRM™ ?",
    answer:
      "Essuyez les rouleaux et la poignée avec un chiffon humide après utilisation. Évitez d’immerger le VOLREP PRM™ dans l’eau.",
  },
  {
    question: "Quelle est votre politique de retour et de garantie ?",
    answer:
      "Le VOLREP PRM™ bénéficie d’un délai de retour de 30 jours et d’une garantie de 2 ans. Contactez notre équipe d’assistance pour plus de détails.",
  },
];

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below. Same
// duplicated scroll-reveal pattern used throughout the site.
const REVEAL_DELAYS = [
  "delay-[0ms]",
  "delay-[60ms]",
  "delay-[120ms]",
  "delay-[180ms]",
  "delay-[240ms]",
  "delay-[300ms]",
  "delay-[360ms]",
  "delay-[420ms]",
  "delay-[480ms]",
  "delay-[540ms]",
  "delay-[600ms]",
  "delay-[660ms]",
];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;
}

function PlusMinusIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-300 ease-out ${
        open ? "text-volt" : "text-foreground"
      }`}
    >
      <span className="absolute h-px w-4 bg-current" />
      <span
        className={`absolute h-4 w-px bg-current transition-transform duration-300 ease-out ${open ? "rotate-90" : "rotate-0"}`}
      />
    </span>
  );
}

type FaqRowProps = {
  item: FaqItem;
  index: number;
  isOpen: boolean;
  isLast: boolean;
  onToggle: () => void;
  visible: boolean;
};

function FaqRow({ item, index, isOpen, isLast, onToggle, visible }: FaqRowProps) {
  const panelId = `product-faq-panel-${index}`;
  const buttonId = `product-faq-button-${index}`;

  return (
    <div className={`${isLast ? "" : "border-b border-black/[0.06]"} ${revealClass(visible, index + 3)}`}>
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 py-7 text-left transition-opacity duration-300 ease-out hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:py-8"
        >
          <span className="text-lg font-bold text-foreground sm:text-xl">{item.question}</span>
          <PlusMinusIcon open={isOpen} />
        </button>
      </h3>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="max-w-[560px] pb-7 text-[15px] leading-relaxed text-muted-foreground sm:pb-8">{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

// FAQ section for the product page — an editorial two-column layout (fixed
// intro left, wide accordion right on desktop; stacked on mobile/tablet),
// deliberately distinct from the homepage's centered-card FAQ
// (components/home/FAQ.tsx, untouched) so this reads as this page's own
// FAQ rather than a copy of it. Named ProductFAQ (not FAQ) specifically so
// importing this file never gets confused with that one.
export function ProductFAQ() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
    <section ref={sectionRef} aria-labelledby="product-faq-heading" className="bg-background py-16 sm:py-20 lg:py-24">
      <PageContainer>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
          <div>
            <p
              className={`flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground ${revealClass(visible, 0)}`}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
              FAQ
            </p>

            <h2
              id="product-faq-heading"
              className={`mt-5 text-[1.75rem] uppercase leading-[0.94] tracking-[-0.02em] text-foreground sm:text-[2.375rem] lg:text-[2rem] xl:text-[2.875rem] ${revealClass(visible, 1)}`}
            >
              Vos questions, nos réponses.
            </h2>

            <p className={`mt-5 max-w-[380px] text-base leading-relaxed text-muted-foreground sm:text-lg ${revealClass(visible, 2)}`}>
              Tout ce qu’il faut savoir sur le VOLREP PRM<span aria-hidden="true">™</span> avant de l’intégrer à
              votre routine de récupération.
            </p>
          </div>

          <div>
            {FAQS.map((item, index) => (
              <FaqRow
                key={item.question}
                item={item}
                index={index}
                isOpen={openIndex === index}
                isLast={index === FAQS.length - 1}
                onToggle={() => setOpenIndex((prev) => (prev === index ? null : index))}
                visible={visible}
              />
            ))}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
