import type { HomepageDocument, HomepageSection } from "@/lib/homepage/types";

// The sections HomepageRenderer actually renders: `document.sections` order
// preserved exactly (Homepage Studio supports reorder — this must never
// re-sort), disabled sections dropped. Kept as a pure function, separate
// from HomepageRenderer's JSX, so order/enabled logic is unit-testable
// without a DOM.
export function visibleHomepageSections(document: HomepageDocument): HomepageSection[] {
  return document.sections.filter((section) => section.enabled);
}
