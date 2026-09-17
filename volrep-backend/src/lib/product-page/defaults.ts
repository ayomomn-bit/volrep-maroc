import { parsePageDocument, type PageDocument } from "./schema.js";

// ---------------------------------------------------------------------------
// DEFAULT_PAGE_DOCUMENT — the current customer-facing product page,
// transcribed 1:1 from volrep-maroc components/product-landing/ProductLanding.tsx
// (captured 2026-09-01, see volrep-maroc/docs/product-page-inventory.md).
//
// This document is:
//   - the seed for product_pages.draft / .published on a fresh product
//   - the storefront fallback when product_pages.published is NULL
//
// DO NOT edit the wording here to "improve" it — this is a faithful copy of
// what ships today. Curly apostrophes (U+2019), non-breaking spaces
// ( ), guillemets and the "**bold** / *italic* / \n" emphasis notation
// are all intentional and must match the live page.
//
// The storefront keeps its own byte-identical copy
// (volrep-maroc/lib/product-page/default-sections.ts); a test on each side
// guards the pair.
// ---------------------------------------------------------------------------

const ph = (placeholderLabel: string) => ({ kind: "placeholder" as const, placeholderLabel });

const raw = {
  version: 1,
  settings: {},
  sections: [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      data: {
        subtitle: "Masseur de récupération percussive",
        reviewsFallbackLabel: "Avis clients vérifiés",
        reviewsCountSuffix: "avis vérifiés",
        features: [
          { icon: "🖐️", label: "Mains libres" },
          { icon: "💪", label: "Sans douleur" },
          { icon: "⚙️", label: "Design ergonomique" },
          { icon: "🔋", label: "Sans fil · USB-C" },
        ],
        ctaLabel: "Commander maintenant — {price}",
        ctaSubtext: "⚡ Stock limité, profitez de la promo maintenant",
        ctaSubtextSmall: "{price} à payer à la livraison · Livraison GRATUITE 🚚",
        guarantees: [
          { icon: "🛡️", text: "Garantie incluse" },
          { icon: "🔇", text: "Puissant & silencieux" },
          { icon: "↩️", text: "Retours faciles" },
        ],
        guaranteeBox: {
          icon: "✓",
          title: "Satisfait ou remboursé 30 jours",
          body: "Si vous n’êtes pas 100% satisfait, nous reprenons le produit. Votre achat est protégé à 100%.",
        },
        description: [
          "Le **VOLREP PRM™** est un masseur de récupération percussive 2-en-1 qui combine massage roulant et percussion pour soulager mollets, cuisses, dos et nuque après l’effort. Grâce à son utilisation mains libres, plus besoin de tenir l’appareil pendant de longues minutes.",
          "Avec plusieurs niveaux d’intensité et une conception ergonomique, chaque séance s’adapte à votre sensibilité et à vos besoins.",
        ],
        beforeAfter: {
          enabled: true,
          title: "Une récupération profonde, mains libres",
          subtitle: "Avant / après une séance",
          beforeLabel: "AVANT",
          afterLabel: "APRÈS",
          zones: [
            { name: "Mollets", media: ph("Mollets · avant / après") },
            { name: "Nuque", media: ph("Nuque · avant / après") },
            { name: "Dos", media: ph("Dos · avant / après") },
            { name: "Cuisses", media: ph("Cuisses · avant / après") },
          ],
          disclaimer:
            "Les ressentis individuels peuvent varier. Chaque séance s’adapte à votre corps.",
        },
      },
    },
    {
      id: "ugc",
      type: "ugc",
      enabled: true,
      data: {
        heading: "Ce que disent *nos clients*",
        videos: [
          { media: ph("Vidéo client · à venir") },
          { media: ph("Vidéo client · à venir") },
          { media: ph("Vidéo client · à venir") },
          { media: ph("Vidéo client · à venir") },
          { media: ph("Vidéo client · à venir") },
        ],
      },
    },
    {
      id: "descriptionFaq",
      type: "descriptionFaq",
      enabled: true,
      data: {
        heading: "",
        defaultOpen: 0,
        items: [
          {
            question: "Description",
            answer:
              "Le VOLREP PRM™ est un masseur de récupération percussive qui combine massage roulant et percussion pour soulager les muscles fatigués. Il cible mollets, cuisses, dos et nuque avec plusieurs niveaux d’intensité, en usage mains libres ou tenu à la main.",
          },
          {
            question: "Combien de temps pour sentir les effets ?",
            answer:
              "La plupart des clients ressentent un relâchement dès la première séance de 5 à 10 minutes. Pour un effet plus durable sur la fatigue et les tensions accumulées, une utilisation régulière — idéalement chaque soir la première semaine — est recommandée.",
          },
          {
            question: "Comment l’utiliser ?",
            answer:
              "Placez le muscle à travailler sur le rouleau, choisissez votre intensité en commençant doucement, puis laissez l’appareil travailler. Vous pouvez aussi le tenir à la main pour cibler d’autres zones comme les épaules ou les avant-bras.",
          },
          {
            question: "Est-il sûr à utiliser ?",
            answer:
              "Oui, l’appareil est conçu pour un usage quotidien à la maison, avec une intensité adaptable à votre sensibilité. Évitez une zone blessée, une plaie ouverte, ou en cas de problème de circulation sans avis médical préalable.",
          },
        ],
      },
    },
    {
      id: "professionals",
      type: "professionals",
      enabled: true,
      data: {
        title: "Recommandé par les professionnels",
        labels: ["Kinésithérapeutes", "Coachs sportifs", "Préparateurs physiques", "Ostéopathes"],
      },
    },
    {
      id: "bigResult",
      type: "bigResult",
      enabled: true,
      data: {
        heading: "Vrais clients,\n*vrais résultats*",
        media: ph("Résultat client · avant / après"),
        disclaimer:
          "Les ressentis individuels peuvent varier. Chaque séance de massage est différente et s’adapte à votre corps.",
      },
    },
    {
      id: "benefits",
      type: "benefits",
      enabled: true,
      data: {
        media: ph("Démonstration produit"),
        heading: "Dites bonjour à *des muscles enfin détendus*",
        subtitle:
          "Une récupération profonde et sans effort, séance après séance, grâce au VOLREP PRM™.",
        blocks: [
          {
            title: "Glisse sans effort",
            desc: "Mouvement roulant fluide et continu, efficace sur les mollets, les cuisses, le dos et la nuque.",
            tags: ["Massage profond", "Utilisation flexible"],
          },
          {
            title: "Moteur puissant & silencieux",
            desc: "Un massage rapide, efficace et sans douleur — une vraie séance de récupération à domicile.",
            tags: ["Récupération rapide", "Sans douleur"],
          },
          {
            title: "Technologie anti-tension",
            desc: "Conçu pour relâcher les points de tension en profondeur, sans jamais fatiguer vos mains.",
            tags: ["Doux pour le corps", "Zéro fatigue des mains"],
          },
        ],
      },
    },
    {
      id: "sayGoodbye",
      type: "sayGoodbye",
      enabled: true,
      data: {
        media: ph("Le VOLREP PRM™ en action"),
        title: "Dites adieu à",
        items: ["Douleurs musculaires", "Jambes lourdes", "Tensions accumulées"],
        desc: "Dites au revoir aux douleurs du quotidien et aux tensions accumulées. Des milliers de personnes ont déjà transformé leur routine de récupération grâce au **VOLREP PRM™**.",
      },
    },
    {
      id: "endorsement",
      type: "endorsement",
      enabled: true,
      data: {
        avatar: "🩺",
        quote:
          "« Je recommande le VOLREP PRM™ pour une récupération musculaire efficace et sûre. La combinaison du mouvement roulant et de la percussion fait une vraie différence. »",
        name: "— Dr. Amine T., **Kinésithérapeute**",
        title: "Approuvé par les *kinésithérapeutes*",
        desc: "Pensé avec des kinésithérapeutes, le **VOLREP PRM™** procure un massage doux et efficace, adapté à tous types de muscles, pour une sensation de relâchement durable sans effort.",
        proTip: {
          badge: "Commandez maintenant",
          text: "Pour profiter du meilleur prix, commandez dès maintenant, avant que le stock ne soit épuisé et que les prix ne reviennent à la normale.",
        },
      },
    },
    {
      id: "comparison",
      type: "comparison",
      enabled: true,
      data: {
        heading: "Pourquoi choisir *VOLREP PRM™* ?",
        subtitle: "La meilleure solution pour une récupération parfaite à la maison",
        productName: "VOLREP PRM™",
        // Empty: the storefront falls back to the product's featured/first
        // gallery image (the pre-Studio behaviour) until an image is chosen.
        media: ph("Visuel produit"),
        competitors: ["Pistolet de massage", "Massage en institut"],
        rows: [
          { label: "Mains libres, sans effort", product: "yes", competitors: ["no", "no"] },
          {
            label: "Massage roulant + percussif combiné",
            product: "yes",
            competitors: ["no", "partial"],
          },
          { label: "Intensité réglable", product: "yes", competitors: ["partial", "no"] },
          { label: "Sans fatiguer les bras / mains", product: "yes", competitors: ["no", "no"] },
          {
            label: "Résultat comme en institut, à la maison",
            product: "yes",
            competitors: ["partial", "no"],
          },
          {
            label: "2-en-1 : mains libres / à la main",
            product: "yes",
            competitors: ["no", "no"],
          },
        ],
      },
    },
    {
      id: "reviews",
      type: "reviews",
      enabled: true,
      data: {
        heading: "Ce que disent *nos clients*",
        maxCount: 6,
        emptyText: "Soyez le premier à partager votre expérience avec le VOLREP PRM™.",
      },
    },
    {
      id: "trust",
      type: "trust",
      enabled: true,
      data: {
        items: [
          { icon: "🚚", title: "Livraison partout au Maroc", desc: "48-72h dans toutes les villes" },
          { icon: "💵", title: "Paiement à la livraison", desc: "Payez uniquement à la réception" },
          { icon: "📞", title: "Support client", desc: "7j/7 par téléphone & WhatsApp" },
          { icon: "🔄", title: "Satisfait ou remboursé", desc: "Garantie 30 jours" },
        ],
      },
    },
    {
      id: "faq",
      type: "faq",
      enabled: true,
      data: {
        heading: "Questions *fréquentes*",
        defaultOpen: 0,
        items: [
          {
            question: "Comment fonctionne le VOLREP PRM™ exactement ?",
            answer:
              "Il combine deux techniques : un rouleau motorisé qui roule en continu sur la zone à masser, et un mouvement percussif qui presse et relâche le muscle à chaque passage. L’appareil s’adapte à la forme de votre mollet, cuisse ou dos pendant qu’il tourne, pour un massage homogène sans que vous ayez à bouger la main.",
          },
          {
            question: "Puis-je l’utiliser sur des zones sensibles ?",
            answer:
              "Oui. Plusieurs niveaux d’intensité sont disponibles, de la plus douce à la plus intense. Commencez toujours par le niveau le plus bas les premières fois, puis augmentez progressivement selon votre tolérance.",
          },
          {
            question: "Quelle est l’autonomie de la batterie ?",
            answer:
              "En usage modéré (séances courtes, intensité basse), l’autonomie couvre largement plusieurs séances. La recharge se fait via le câble USB-C inclus, compatible avec n’importe quel chargeur ou power bank USB-C.",
          },
          {
            question: "Peut-on l’utiliser ailleurs que sur les jambes ?",
            answer:
              "Oui. Vous pouvez l’utiliser sur les mollets, les cuisses, le dos, les épaules et les avant-bras, en mains libres pour le bas du corps ou tenu à la main pour le reste.",
          },
          {
            question: "Quelle est la garantie ?",
            answer:
              "Le VOLREP PRM™ est couvert par une garantie. En cas de panne durant cette période, l’appareil est réparé ou remplacé.",
          },
          {
            question: "Que faire si je ne suis pas satisfait après réception ?",
            answer:
              "Vous disposez de 30 jours pour tester le produit. S’il ne vous convient pas, vous pouvez le retourner et être remboursé intégralement, sans justification compliquée.",
          },
        ],
      },
    },
    {
      id: "problemSolution",
      type: "problemSolution",
      enabled: true,
      data: {
        warningIcon: "⚠️",
        warningText: "Sans mouvement roulant, les tensions reviennent vite",
        title: "Pourquoi un pistolet de massage *seul ne suffit pas ?*",
        problems: [
          {
            icon: "🔴",
            title: "Fatigue des mains",
            text: "La main se fatigue après quelques minutes à tenir l’appareil.",
          },
          {
            icon: "🔴",
            title: "Couverture limitée",
            text: "Un seul point de contact à la fois, la séance prend plus de temps.",
          },
          {
            icon: "🔴",
            title: "Pas de mouvement roulant",
            text: "La percussion seule ne remplace pas un vrai massage qui glisse et enveloppe le muscle.",
          },
        ],
        solutionLabel: "LA SOLUTION",
        solution: {
          icon: "✓",
          title: "La combinaison qui change tout",
          text: "**VOLREP PRM™** = rouleau motorisé + percussion intégrée. Mains libres, couverture totale, détente immédiate. La routine de récupération qui remplace tous les autres appareils.",
        },
      },
    },
    {
      id: "order",
      type: "order",
      enabled: true,
      data: {
        title: "Confirmez votre *commande*",
        subtitle: "Remplissez le formulaire — nous vous appelons pour confirmer",
      },
    },
    {
      id: "stickyCta",
      type: "stickyCta",
      enabled: true,
      data: { label: "Commander maintenant" },
    },
  ],
};

// Parsed once at module load — normalizes every media slot to its full shape
// and hard-fails (here and in the test suite) if the transcription ever
// drifts out of the schema.
export const DEFAULT_PAGE_DOCUMENT: PageDocument = parsePageDocument(raw);

export const DEFAULT_SECTION_ORDER = DEFAULT_PAGE_DOCUMENT.sections.map((s) => s.id);
