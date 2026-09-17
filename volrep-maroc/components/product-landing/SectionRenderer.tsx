import type { PageSection } from "@/lib/product-page/types";
import type { SectionContext } from "@/components/product-landing/context";
import {
  AccordionSection,
  BenefitsSection,
  BigResultSection,
  ComparisonSection,
  EndorsementSection,
  HeroSection,
  OrderSection,
  ProblemSolutionSection,
  ProfessionalsSection,
  ReviewsSection,
  SayGoodbyeSection,
  StickyCtaSection,
  TrustSection,
  UgcSection,
} from "@/components/product-landing/sections";

// Renders the "Page produit" document: the sections that are `enabled`, in
// stored order, each dispatched to its renderer. An unknown `type` (a
// document from a newer backend) is skipped rather than crashing the page.
export function SectionRenderer({
  sections,
  ctx,
}: {
  sections: PageSection[];
  ctx: SectionContext;
}) {
  return (
    <>
      {sections
        .filter((section) => section.enabled)
        .map((section) => {
          switch (section.type) {
            case "hero":
              return <HeroSection key={section.id} data={section.data} ctx={ctx} />;
            case "ugc":
              return <UgcSection key={section.id} data={section.data} />;
            case "descriptionFaq":
              return (
                <AccordionSection
                  key={section.id}
                  data={section.data}
                  sectionClass="mini-faq"
                  withHeading={false}
                />
              );
            case "professionals":
              return <ProfessionalsSection key={section.id} data={section.data} />;
            case "bigResult":
              return <BigResultSection key={section.id} data={section.data} />;
            case "benefits":
              return <BenefitsSection key={section.id} data={section.data} />;
            case "sayGoodbye":
              return <SayGoodbyeSection key={section.id} data={section.data} />;
            case "endorsement":
              return <EndorsementSection key={section.id} data={section.data} />;
            case "comparison":
              return <ComparisonSection key={section.id} data={section.data} ctx={ctx} />;
            case "reviews":
              return <ReviewsSection key={section.id} data={section.data} ctx={ctx} />;
            case "trust":
              return <TrustSection key={section.id} data={section.data} />;
            case "faq":
              return (
                <AccordionSection
                  key={section.id}
                  data={section.data}
                  sectionClass="faq-section"
                  withHeading
                />
              );
            case "problemSolution":
              return <ProblemSolutionSection key={section.id} data={section.data} />;
            case "order":
              return <OrderSection key={section.id} data={section.data} ctx={ctx} />;
            case "stickyCta":
              return <StickyCtaSection key={section.id} data={section.data} ctx={ctx} />;
            default:
              return null;
          }
        })}
    </>
  );
}
