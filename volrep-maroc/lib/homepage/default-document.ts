import type { HomepageDocument, HomepageMediaSlot } from "@/lib/homepage/types";

// ---------------------------------------------------------------------------
// DEFAULT_HOMEPAGE_DOCUMENT — a byte-for-byte copy of the backend's
// volrep-backend/src/lib/homepage/defaults.ts (itself a 1:1 transcription of
// what app/page.tsx + components/home/*.tsx + lib/i18n.ts (`t.home.*`)
// rendered before this migration).
//
// It is ONLY the fallback: the storefront normally renders the `published`
// document from GET /api/homepage. This copy is used when the backend is
// unreachable, returns an unrecognised shape, or nothing has been published
// yet, so the homepage never blanks. The two copies must stay in sync — a
// change to the backing default MUST be mirrored here.
//
// DO NOT edit the wording here to "improve" it — curly apostrophes
// (U+2019), the non-breaking space (U+00A0) before "?", em dashes, star
// glyphs and the marketing statistics are all intentional and must match
// the live page byte for byte.
// ---------------------------------------------------------------------------

const CDN = "https://cdn.shopify.com/s/files/1/1010/7476/4088/files";

const urlImage = (url: string, alt: string): HomepageMediaSlot => ({
  kind: "url",
  imageId: null,
  url,
  poster: "",
  alt,
  placeholderLabel: "",
  mediaType: "image",
  fileName: "",
});

const placeholder = (placeholderLabel = ""): HomepageMediaSlot => ({
  kind: "placeholder",
  imageId: null,
  url: "",
  poster: "",
  alt: "",
  placeholderLabel,
  mediaType: "image",
  fileName: "",
});

export const DEFAULT_HOMEPAGE_DOCUMENT: HomepageDocument = {
  version: 1,
  settings: {},
  sections: [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      data: {
        eyebrow: "Récupération",
        heading: "Récupérez chaque jour.",
        body:
          "VOLREP™ crée des outils de récupération premium pensés pour votre routine quotidienne — à commencer par le VOLREP PRM™, notre masseur de récupération percussive.",
        primaryCta: { label: "Acheter la récupération", href: "/products/volrep-prm" },
        secondaryCta: { label: "Découvrir le VOLREP PRM™", href: "/products/volrep-prm" },
        visual: {
          media: placeholder(),
          badge: "01",
          productName: "VOLREP PRM™",
          caption: "Masseur de récupération percussive",
        },
      },
    },
    {
      id: "bestSellers",
      type: "bestSellers",
      enabled: true,
      data: {
        eyebrow: "Boutique",
        heading: "Meilleures ventes",
        body: "Des outils de récupération conçus pour votre routine quotidienne.",
        source: { mode: "catalog", limit: 8 },
      },
    },
    {
      id: "recoveryPhilosophy",
      type: "recoveryPhilosophy",
      enabled: true,
      data: {
        eyebrow: "Récupération",
        heading: "La récupération n'est pas\nune option secondaire.",
        body:
          "Elle fait partie de votre façon de bouger, de vous entraîner, de travailler et de vivre chaque jour.",
        cta: { label: "Découvrir la récupération", href: "/products/volrep-prm" },
        background: urlImage(
          `${CDN}/VOLREP-Section-3-Background.webp?v=1786449309`,
          "Une personne utilisant le VOLREP PRM™ lors d’une séance de récupération à la maison",
        ),
      },
    },
    {
      id: "recoverEverywhere",
      type: "recoverEverywhere",
      enabled: true,
      data: {
        heading: "Récupérez\npartout.",
        subtitle: "Une récupération professionnelle conçue pour chaque partie de votre corps.",
        ctaLabel: "Découvrir",
        ctaHref: "/products/volrep-prm",
        zones: [
          {
            title: "Récupération du dos",
            description: "Soulagez les tensions du bas du dos après de longues journées de travail.",
            media: urlImage(`${CDN}/Back-recovery.webp`, ""),
            objectPosition: "object-right",
            span: "lg:col-span-2",
          },
          {
            title: "Soulagement de la nuque",
            description:
              "Relâchez les tensions de la nuque accumulées après de longues journées au bureau.",
            media: urlImage(`${CDN}/Neck-recovery.webp`, ""),
            objectPosition: "object-right",
            span: "lg:col-span-2",
          },
          {
            title: "Récupération des jambes",
            description: "Soulagez les jambes fatiguées après l’entraînement ou un déplacement.",
            media: urlImage(`${CDN}/Leg-recovery.webp`, ""),
            objectPosition: "object-center",
            span: "lg:col-span-2",
          },
          {
            title: "Détente des épaules",
            description:
              "Dénouez les tensions des épaules liées à l’entraînement et au stress quotidien.",
            media: urlImage(`${CDN}/Shoulder-recovery.webp`, ""),
            objectPosition: "object-right",
            span: "lg:col-span-3",
          },
          {
            title: "Massage des pieds",
            description:
              "Offrez à vos pieds fatigués un moment de soulagement après une longue journée.",
            media: urlImage(`${CDN}/Foot-recovery.webp`, ""),
            objectPosition: "object-center",
            span: "lg:col-span-3",
          },
        ],
      },
    },
    {
      id: "whyVolrep",
      type: "whyVolrep",
      enabled: true,
      data: {
        eyebrow: "Technologie",
        heading: "Pourquoi\nVolrep ?",
        subtitle: "Une technologie de récupération premium conçue pour la performance au quotidien.",
        features: [
          {
            number: "01",
            title: "Matériaux premium",
            description:
              "Fabriqué avec des matériaux durables de qualité supérieure, pensés pour la récupération quotidienne et la performance sur la durée.",
            icon: "shield",
          },
          {
            number: "02",
            title: "Soulagement musculaire profond",
            description:
              "Cible les tensions musculaires profondes plus efficacement que les rouleaux en mousse classiques, pour une récupération plus rapide.",
            icon: "wave",
          },
          {
            number: "03",
            title: "Performance silencieuse",
            description:
              "Doté d’un moteur puissant mais ultra-silencieux, pour des séances de récupération fluides et sans distraction.",
            icon: "soundwave",
          },
          {
            number: "04",
            title: "Conçu pour durer",
            description:
              "Pensé pour des milliers de séances de récupération, avec une fiabilité sur laquelle compter chaque jour.",
            icon: "check",
          },
        ],
        stats: [
          { value: 5, suffix: "+", label: "Modes de récupération" },
          { value: 3, suffix: "h", label: "Autonomie" },
          { value: 365, suffix: "", label: "Jours de récupération" },
          { value: 2, suffix: " ans", label: "Garantie" },
        ],
      },
    },
    {
      id: "testimonials",
      type: "testimonials",
      enabled: true,
      data: {
        eyebrow: "Avis",
        heading: "Adopté par les sportifs.\nApprouvé chaque jour.",
        body:
          "Rejoignez les milliers de personnes qui utilisent VOLREP pour récupérer plus vite, réduire les tensions musculaires et se sentir mieux chaque jour.",
        rating: {
          stars: "★★★★★",
          label: "Note de 4,9/5",
          description: "Sur la base de plus de 2 000 clients vérifiés",
        },
        verifiedLabel: "Client vérifié",
        cards: [
          {
            name: "Michael R.",
            quote:
              "Le meilleur outil de récupération que j’aie jamais eu. Je l’utilise après chaque entraînement et ma récupération n’a jamais été aussi bonne.",
          },
          {
            name: "Sarah K.",
            quote:
              "Je me réveillais avec des douleurs au dos presque tous les matins. Depuis que j’utilise VOLREP chaque jour, la différence est incroyable.",
          },
          {
            name: "Daniel T.",
            quote:
              "La qualité de fabrication est premium : silencieux, puissant, et il fait désormais partie de ma routine quotidienne.",
          },
        ],
        trustline: {
          rating: "4.9/5",
          label: "Ils nous font confiance",
          audiences: ["Sportifs", "Kinésithérapeutes", "Coachs sportifs"],
        },
        trustItems: [
          { value: "95 000+", label: "Clients satisfaits" },
          { value: "4,9★", label: "Note moyenne" },
          { value: "30 jours", label: "Satisfait ou remboursé" },
          { value: "2 ans", label: "Garantie" },
        ],
      },
    },
    {
      id: "faq",
      type: "faq",
      enabled: true,
      data: {
        eyebrow: "FAQ",
        heading: "Questions fréquentes",
        subtitle: "Tout ce qu’il faut savoir avant de commencer votre parcours de récupération.",
        defaultOpen: -1,
        items: [
          {
            question: "Sur quels muscles peut-on utiliser VOLREP ?",
            answer:
              "VOLREP est conçu pour le dos, la nuque, les épaules, les jambes, les mollets, les pieds et de nombreux autres groupes musculaires.",
          },
          {
            question: "À quelle fréquence l’utiliser ?",
            answer:
              "La plupart des utilisateurs se servent de VOLREP 10 à 20 minutes par jour, selon leurs besoins de récupération.",
          },
          {
            question: "Convient-il aux débutants ?",
            answer:
              "Oui. Ses différents niveaux d’intensité le rendent adapté aussi bien aux débutants qu’aux sportifs confirmés.",
          },
          {
            question: "Quelle est l’autonomie de la batterie ?",
            answer: "Jusqu’à 3 heures d’utilisation continue selon l’intensité.",
          },
          {
            question: "Est-il garanti ?",
            answer: "Oui. Chaque appareil VOLREP est couvert par une garantie de 2 ans.",
          },
          {
            question: "Et si je ne suis pas satisfait ?",
            answer:
              "Nous proposons une politique de retour sans complications pour que vous puissiez essayer VOLREP en toute confiance.",
          },
        ],
      },
    },
    {
      id: "finalCta",
      type: "finalCta",
      enabled: true,
      data: {
        eyebrow: "Commencez aujourd’hui",
        heading: "Mieux récupérer.\nBouger plus fort.",
        body:
          "Une technologie de récupération professionnelle conçue pour les sportifs, les modes de vie actifs et le bien-être au quotidien.",
        primaryCta: { label: "Acheter maintenant", href: "/products/volrep-prm" },
        secondaryCta: { label: "En savoir plus", href: "#why-volrep-heading" },
        rating: { stars: "★★★★★", label: "Note de 4,9/5" },
        badges: [
          { icon: "truck", label: "Livraison offerte" },
          { icon: "shield", label: "Garantie 2 ans" },
          { icon: "return", label: "Retours sous 30 jours" },
        ],
      },
    },
    {
      id: "newsletter",
      type: "newsletter",
      enabled: true,
      data: {
        eyebrow: "Newsletter",
        heading: "Restez en\nrécupération.",
        body:
          "Recevez des conseils de récupération, des lancements exclusifs et un accès anticipé aux nouveautés.",
        emailLabel: "Adresse e-mail",
        emailPlaceholder: "Entrez votre e-mail",
        submitLabel: "S’inscrire",
        successMessage: "Vous êtes inscrit. Bienvenue chez VOLREP.",
      },
    },
  ],
};

export const DEFAULT_HOMEPAGE_SECTION_ORDER = DEFAULT_HOMEPAGE_DOCUMENT.sections.map((s) => s.id);
