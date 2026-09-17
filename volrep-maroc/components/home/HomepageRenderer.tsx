import { Hero } from "@/components/home/Hero";
import { BestSellers } from "@/components/home/BestSellers";
import { RecoveryPhilosophy } from "@/components/home/RecoveryPhilosophy";
import { RecoverEverywhere } from "@/components/home/RecoverEverywhere";
import { WhyVolrep } from "@/components/home/WhyVolrep";
import { Testimonials } from "@/components/home/Testimonials";
import { FAQ } from "@/components/home/FAQ";
import { FinalCTA } from "@/components/home/FinalCTA";
import { Newsletter } from "@/components/home/Newsletter";
import type { HomepageDocument, HomepageSection } from "@/lib/homepage/types";
import { visibleHomepageSections } from "@/lib/homepage/visible-sections";

// Renders a published/fallback Homepage Studio document using the existing
// homepage section components — a strict typed switch (no dynamic import /
// component lookup by string). Section order and enabled state come from
// `document.sections`; the canonical V1 order is never hardcoded here so
// Homepage Studio's reorder feature works without a code change.
function renderSection(section: HomepageSection) {
  switch (section.type) {
    case "hero":
      return <Hero key={section.id} data={section.data} />;
    case "bestSellers":
      return <BestSellers key={section.id} data={section.data} />;
    case "recoveryPhilosophy":
      return <RecoveryPhilosophy key={section.id} data={section.data} />;
    case "recoverEverywhere":
      return <RecoverEverywhere key={section.id} data={section.data} />;
    case "whyVolrep":
      return <WhyVolrep key={section.id} data={section.data} />;
    case "testimonials":
      return <Testimonials key={section.id} data={section.data} />;
    case "faq":
      return <FAQ key={section.id} data={section.data} />;
    case "finalCta":
      return <FinalCTA key={section.id} data={section.data} />;
    case "newsletter":
      return <Newsletter key={section.id} data={section.data} />;
  }
}

export function HomepageRenderer({ document }: { document: HomepageDocument }) {
  return <>{visibleHomepageSections(document).map(renderSection)}</>;
}
