import type { PageSection, PageSectionType } from "@/lib/types";

// Pure helpers for the "Page produit" tab. No React, no i18n side-effects
// beyond the static label map below (admin-only UI strings that DESCRIBE
// each section — never storefront content).

export const SECTION_META: Record<PageSectionType, { label: string; description: string }> = {
  hero: {
    label: "Hero",
    description: "Galerie, titre, prix, avis, garanties + bloc avant/après.",
  },
  ugc: { label: "Vidéos clients", description: "Carrousel horizontal de témoignages vidéo." },
  descriptionFaq: {
    label: "Description (accordéon)",
    description: "Mini-accordéon « Description » sous le hero.",
  },
  professionals: {
    label: "Professionnels",
    description: "Bandeau « Recommandé par les professionnels ».",
  },
  bigResult: { label: "Grand résultat", description: "Visuel avant/après pleine largeur." },
  benefits: {
    label: "Bénéfices",
    description: "Bloc « Dites bonjour à… » + 3 blocs de bénéfices.",
  },
  sayGoodbye: {
    label: "Dites adieu à",
    description: "Liste barrée des douleurs + visuel produit.",
  },
  endorsement: {
    label: "Caution kinésithérapeute",
    description: "Citation + section « Approuvé par les kinésithérapeutes ».",
  },
  comparison: {
    label: "Comparatif",
    description: "Tableau VOLREP PRM™ vs alternatives.",
  },
  reviews: {
    label: "Avis clients",
    description: "Affiche les avis réels — contrôles d’affichage uniquement.",
  },
  trust: { label: "Réassurance", description: "Grille des 4 garanties." },
  faq: { label: "FAQ", description: "Questions fréquentes (accordéon)." },
  problemSolution: {
    label: "Problème → solution",
    description: "« Pourquoi un pistolet de massage seul ne suffit pas ».",
  },
  order: {
    label: "Commande",
    description: "Titre/sous-titre au-dessus du formulaire. Le formulaire COD reste inchangé.",
  },
  stickyCta: { label: "CTA flottant", description: "Barre mobile fixe en bas de page." },
};

// The canonical order the page migrated with (for reference / display).
export const SECTION_ORDER: PageSectionType[] = [
  "hero",
  "ugc",
  "descriptionFaq",
  "professionals",
  "bigResult",
  "benefits",
  "sayGoodbye",
  "endorsement",
  "comparison",
  "reviews",
  "trust",
  "faq",
  "problemSolution",
  "order",
  "stickyCta",
];

export function sectionLabel(type: PageSectionType): string {
  return SECTION_META[type]?.label ?? type;
}

export function sectionDescription(type: PageSectionType): string {
  return SECTION_META[type]?.description ?? "";
}

// Move the section at `from` to index `to`, returning a new array.
export function moveSection(sections: PageSection[], from: number, to: number): PageSection[] {
  if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length) {
    return sections;
  }
  const next = [...sections];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}

// A fresh, unique id for a duplicated section: "<type>-2", "<type>-3", …
export function nextSectionId(type: PageSectionType, existing: PageSection[]): string {
  const used = new Set(existing.map((s) => s.id));
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${type}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${type}-${Date.now()}`;
}

// Insert a deep copy of the section at `index` right after it, with a new id.
export function duplicateSection(sections: PageSection[], index: number): PageSection[] {
  const source = sections[index];
  if (!source) return sections;
  const clone = structuredClone(source);
  clone.id = nextSectionId(source.type, sections);
  const next = [...sections];
  next.splice(index + 1, 0, clone);
  return next;
}

export function removeSection(sections: PageSection[], index: number): PageSection[] {
  return sections.filter((_, i) => i !== index);
}

export function setSectionAt(
  sections: PageSection[],
  index: number,
  updater: (section: PageSection) => PageSection,
): PageSection[] {
  return sections.map((section, i) => (i === index ? updater(section) : section));
}

// A one-line summary shown on the collapsed section card.
export function sectionSummary(section: PageSection): string {
  switch (section.type) {
    case "hero":
      return section.data.subtitle;
    case "ugc":
      return `${section.data.videos.length} emplacement(s) vidéo`;
    case "descriptionFaq":
    case "faq":
      return `${section.data.items.length} question(s)`;
    case "professionals":
      return section.data.labels.join(" · ");
    case "bigResult":
      return stripEmphasis(section.data.heading);
    case "benefits":
      return `${section.data.blocks.length} bénéfice(s)`;
    case "sayGoodbye":
      return section.data.items.join(" · ");
    case "endorsement":
      return stripEmphasis(section.data.title);
    case "comparison":
      return `${section.data.rows.length} ligne(s), ${section.data.competitors.length} concurrent(s)`;
    case "reviews":
      return `Jusqu’à ${section.data.maxCount} avis`;
    case "trust":
      return `${section.data.items.length} garantie(s)`;
    case "problemSolution":
      return `${section.data.problems.length} problème(s)`;
    case "order":
      return stripEmphasis(section.data.title);
    case "stickyCta":
      return section.data.label;
    default:
      return "";
  }
}

function stripEmphasis(text: string): string {
  return text.replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\n/g, " ").trim();
}
