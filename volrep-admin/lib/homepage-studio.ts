import type { HomepageDocument, HomepageSection, HomepageSectionType } from "@/lib/types";
import { t } from "@/lib/i18n";

// Pure helpers for Homepage Studio (Step 2). No React. The section label /
// description maps are admin-only UI strings that DESCRIBE each section —
// never storefront content.

// The V1 homepage is exactly these 9 sections, each present once, in this
// canonical order (matches volrep-backend DEFAULT_HOMEPAGE_DOCUMENT and the
// current storefront app/page.tsx). The admin can reorder them but never
// add or remove a section type.
export const HOMEPAGE_SECTION_ORDER: HomepageSectionType[] = [
  "hero",
  "bestSellers",
  "recoveryPhilosophy",
  "recoverEverywhere",
  "whyVolrep",
  "testimonials",
  "faq",
  "finalCta",
  "newsletter",
];

export function sectionLabel(type: HomepageSectionType): string {
  return t.homepage.sectionLabels[type] ?? type;
}

export function sectionDescription(type: HomepageSectionType): string {
  return t.homepage.sectionDescriptions[type] ?? "";
}

// Move the section at `from` to index `to`, returning a NEW array (never
// mutates the input).
export function moveSection<T>(sections: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length) {
    return sections;
  }
  const next = [...sections];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

// Replace the section at `index` with `updater(section)`, returning a NEW
// array (pure).
export function setSectionAt<T>(sections: T[], index: number, updater: (section: T) => T): T[] {
  return sections.map((section, i) => (i === index ? updater(section) : section));
}

// A one-line summary shown on the collapsed section card.
export function sectionSummary(section: HomepageSection): string {
  switch (section.type) {
    case "hero":
      return oneLine(section.data.heading);
    case "bestSellers":
      return `${oneLine(section.data.heading)} · catalogue (${section.data.source.limit})`;
    case "recoveryPhilosophy":
      return oneLine(section.data.heading);
    case "recoverEverywhere":
      return `${section.data.zones.length} zones`;
    case "whyVolrep":
      return `${section.data.features.length} points forts · ${section.data.stats.length} stats`;
    case "testimonials":
      return `${section.data.cards.length} témoignages`;
    case "faq":
      return `${section.data.items.length} questions`;
    case "finalCta":
      return oneLine(section.data.heading);
    case "newsletter":
      return oneLine(section.data.heading);
    default:
      return "";
  }
}

function oneLine(text: string): string {
  return text.replace(/\n+/g, " ").trim();
}

// Derived counts for the Overview tab. Pure — takes the working document.
export type HomepageOverviewStats = {
  sectionCount: number;
  enabledCount: number;
  hiddenCount: number;
};

export function homepageOverviewStats(doc: HomepageDocument): HomepageOverviewStats {
  const sectionCount = doc.sections.length;
  const enabledCount = doc.sections.filter((s) => s.enabled).length;
  return { sectionCount, enabledCount, hiddenCount: sectionCount - enabledCount };
}

// "Are there changes that have never been published?" — combines the
// backend's server-side comparison with the editor's local dirty flag.
export function hasUnpublishedChanges(res: {
  hasPublished: boolean;
  draftMatchesPublished: boolean;
}, localDirty: boolean): boolean {
  if (!res.hasPublished) return true;
  return localDirty || !res.draftMatchesPublished;
}

// Wrap the working sections array back into the full document envelope the
// PUT endpoint expects.
export function toHomepageDocument(sections: HomepageSection[]): HomepageDocument {
  return { version: 1, settings: {}, sections };
}
