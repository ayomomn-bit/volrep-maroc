// ---------------------------------------------------------------------------
// VOLREP storefront — French UI dictionary (single source of truth for copy)
//
// The storefront and the admin are French-only. There is no locale routing
// and no runtime locale switch: every user-facing string lives here (or, for
// long-form editorial/marketing section copy, translated in place inside its
// section component) as professional French, suitable for a Moroccan
// e-commerce store.
//
// Same philosophy as volrep-admin/lib/i18n.ts:
//  - Never hard-code a user-facing UI string in a component. Add a key here.
//  - Keep keys grouped by screen/feature. Interpolated strings are functions.
//  - Backend enum values (order status) are translated through the *Label()
//    helper below, never shown raw.
//  - Technical identifiers (API paths, DB fields, SKUs, product handles, env
//    vars, country/currency codes, provider names) are NOT translated.
//  - Long marketing/editorial copy that Product Studio will eventually own
//    (FAQ answers, testimonials, step lists, section prose, legal-page text)
//    is translated in place in its component rather than inlined here, to
//    keep this file focused on reusable chrome. See each section component.
// ---------------------------------------------------------------------------

export const t = {
  common: {
    brand: "VOLREP",
    productName: "VOLREP PRM™",
    productDescriptor: "Masseur de récupération percussive",
    shopNow: "Acheter maintenant",
    learnMore: "En savoir plus",
    continueShopping: "Continuer mes achats",
    remove: "Retirer",
    genericError: "Une erreur est survenue. Veuillez réessayer.",
    loading: "Chargement…",
    homeSuffix: (shop: string) => `Accueil ${shop}`,
    currencySuffix: "MAD",
  },

  nav: {
    primary: "Navigation principale",
    mobilePrimary: "Navigation mobile principale",
    mobileNavigation: "Navigation mobile",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    cart: "Panier",
    cartWithCount: (count: number) =>
      count > 1 ? `Panier, ${count} articles` : `Panier, ${count} article`,
  },

  promoBar: {
    message: "Récupération premium au quotidien",
  },

  footer: {
    tagline: "Récupérez chaque jour.",
    rightsReserved: (year: number, shop: string) =>
      `© ${year} ${shop}™. Tous droits réservés.`,
  },

  home: {
    hero: {
      eyebrow: "Récupération",
      title: "Récupérez chaque jour.",
      body:
        "VOLREP™ crée des outils de récupération premium pensés pour votre routine quotidienne — à commencer par le VOLREP PRM™, notre masseur de récupération percussive.",
      shopCta: "Acheter la récupération",
      discoverCta: "Découvrir le VOLREP PRM™",
    },
    heroVisual: {
      caption: "Masseur de récupération percussive",
    },
    bestSellers: {
      eyebrow: "Boutique",
      title: "Meilleures ventes",
      body: "Des outils de récupération conçus pour votre routine quotidienne.",
    },
    newsletter: {
      eyebrow: "Newsletter",
      title: ["Restez en", "récupération."],
      body:
        "Recevez des conseils de récupération, des lancements exclusifs et un accès anticipé aux nouveautés.",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "Entrez votre e-mail",
      submit: "S’inscrire",
      success: "Vous êtes inscrit. Bienvenue chez VOLREP.",
    },
  },

  productCard: {
    bestSeller: "Meilleure vente",
    shopAria: (title: string) => `Acheter ${title}`,
    shopNow: "Voir le produit",
  },

  carousel: {
    previousProduct: "Produit précédent",
    nextProduct: "Produit suivant",
  },

  product: {
    reviewsBadge: {
      count: (n: number) => `${n} avis`,
      none: "Aucun avis pour le moment",
      writeFirst: "Rédiger le premier avis",
    },
    price: {
      save: (percent: number) => `−${percent} %`,
    },
    quantity: {
      group: "Quantité",
      decrease: "Diminuer la quantité",
      increase: "Augmenter la quantité",
    },
    addToCart: {
      soldOut: "Rupture de stock",
      adding: "Ajout en cours…",
      added: "Ajouté au panier",
      idle: "Ajouter au panier",
    },
    buyNow: {
      adding: "Ajout en cours…",
      idle: "Acheter maintenant",
    },
    gallery: {
      showImage: (index: number, total: number) => `Afficher l’image ${index} sur ${total}`,
      previousImage: "Image précédente",
      nextImage: "Image suivante",
    },
    reviews: {
      customerReviews: "Avis clients",
      previousReview: "Avis précédent",
      nextReview: "Avis suivant",
      scrollPosition: "Position de défilement des avis",
      additionalReviews: "Avis clients supplémentaires",
      pagination: "Pagination des avis",
      previousPage: "Page d’avis précédente",
      nextPage: "Page d’avis suivante",
      pageOf: (current: number, total: number) => `Page ${current} sur ${total}`,
      verifiedPurchase: "Achat vérifié",
      sampleDisclosure: "Données d’exemple pour l’aperçu — ce ne sont pas de vrais avis clients",
      sampleReviews: "Avis d’exemple",
      basedOn: (n: number) => (n > 1 ? `Sur la base de ${n} avis` : `Sur la base de ${n} avis`),
      notIncluded: "Non inclus",
    },
  },

  cart: {
    eyebrow: "Panier",
    drawerTitle: "Votre panier",
    pageTitle: "Votre panier",
    closeCart: "Fermer le panier",
    emptyTitle: "Votre panier est vide.",
    emptyDrawerBody: "Découvrez le VOLREP PRM™ et commencez votre routine de récupération.",
    emptyPageBody:
      "Vous n’avez encore rien ajouté. Découvrez le VOLREP PRM™ et commencez votre routine de récupération.",
    shopProductCta: "Acheter le VOLREP PRM™",
    subtotal: "Sous-total",
    checkoutArrow: "Passer la commande →",
    viewCart: "Voir le panier",
    orderSummary: "Récapitulatif de la commande",
    taxesNote: "Frais de livraison et taxes calculés à la commande.",
    remove: "Retirer",
    removeAria: (title: string) => `Retirer ${title} du panier`,
  },

  checkoutButton: {
    idle: "Passer la commande",
    navigating: "Redirection…",
  },

  checkout: {
    eyebrow: "Commande",
    title: "Passer la commande",
    metaTitle: "Passer la commande",
    metaDescription: "Finalisez votre commande VOLREP — paiement à la livraison.",
    form: {
      heading: "Coordonnées et livraison",
      firstName: "Prénom",
      firstNamePlaceholder: "Votre prénom",
      lastName: "Nom",
      lastNamePlaceholder: "Votre nom",
      phone: "Numéro de téléphone",
      phonePlaceholder: "06 XX XX XX XX",
      phoneHint: "Nous vous appellerons à ce numéro pour confirmer et organiser la livraison.",
      city: "Ville",
      cityPlaceholder: "Ex : Casablanca",
      address: "Adresse complète",
      addressPlaceholder: "Rue, quartier, numéro, points de repère…",
      codNote: "Payez en espèces à la livraison de votre commande — aucune donnée bancaire n’est collectée en ligne.",
      submitIdle: "Commander (paiement à la livraison)",
      submitPending: "Envoi de la commande…",
      errors: {
        firstNameRequired: "Saisissez votre prénom.",
        lastNameRequired: "Saisissez votre nom.",
        phoneRequired: "Saisissez votre numéro de téléphone.",
        phoneInvalid: "Saisissez un numéro de téléphone marocain valide (ex : 0612345678).",
        cityRequired: "Saisissez votre ville.",
        addressRequired: "Saisissez votre adresse complète.",
        generic: "Une erreur est survenue lors de l’enregistrement de votre commande. Veuillez réessayer.",
      },
    },
    summary: {
      heading: "Récapitulatif de la commande",
      subtotal: "Sous-total",
      shippingNote: "Les frais de livraison sont calculés et affichés une fois votre commande passée.",
    },
    confirmation: {
      title: "Commande confirmée.",
      body:
        "Merci pour votre commande — payez en espèces à la livraison. Nous vous appellerons pour confirmer les détails et organiser la livraison.",
      orderLabel: (number: string) => `Commande ${number}`,
      codBadge: "Paiement à la livraison",
      subtotal: "Sous-total",
      shipping: "Livraison",
      totalOnDelivery: "Total (à payer à la livraison)",
      trackCta: "Suivre ma commande →",
      continueShopping: "Continuer mes achats",
    },
  },

  trackOrder: {
    metaTitle: "Suivre ma commande",
    metaDescription: "Suivez votre commande VOLREP PRM™ et consultez l’état de livraison le plus récent.",
    eyebrow: "Commande / Suivi",
    title: "Suivre ma commande.",
    intro: "Saisissez votre numéro de commande et votre adresse e-mail pour consulter l’état de votre commande.",
    orderNumber: "Numéro de commande",
    orderNumberPlaceholder: "#1001",
    email: "Adresse e-mail",
    emailPlaceholder: "vous@exemple.com",
    submitIdle: "Suivre ma commande →",
    submitPending: "Vérification de la commande…",
    trackAnother: "Suivre une autre commande",
    errors: {
      orderNumberRequired: "Saisissez votre numéro de commande.",
      orderNumberInvalid: "Saisissez un numéro de commande valide, par exemple #1001.",
      emailRequired: "Saisissez votre adresse e-mail.",
      emailInvalid: "Saisissez une adresse e-mail valide.",
      notFound:
        "Nous n’avons trouvé aucune commande correspondant à ces informations. Vérifiez votre numéro de commande et votre adresse e-mail.",
      generic: "Une erreur est survenue. Veuillez réessayer.",
    },
    result: {
      orderLabel: (name: string) => `Commande ${name}`,
      items: "Articles",
      quantity: (n: number) => `Qté ${n}`,
      shipping: "Livraison",
      carrier: "Transporteur",
      trackingNumber: "Numéro de suivi",
      trackShipment: "Suivre le colis →",
      unavailable:
        "Les informations de suivi ne sont pas encore disponibles. Revenez consulter cette page une fois votre commande expédiée.",
    },
  },

  metadata: {
    defaultTitle: "VOLREP™ | Récupérez chaque jour.",
    titleTemplate: "%s | VOLREP™",
    description:
      "VOLREP™ — Récupérez chaque jour. Découvrez le masseur de récupération percussive VOLREP PRM™.",
    cartTitle: "Votre panier",
    cartDescription: "Consultez votre panier VOLREP et finalisez votre commande en toute sécurité.",
  },

  legal: {
    contact: {
      metaTitle: "Contact et assistance",
      metaDescription:
        "Contactez l’équipe d’assistance VOLREP pour toute question sur les commandes, la livraison, les retours ou les produits.",
      eyebrow: "Contact",
      title: "Comment pouvons-nous vous aider ?",
      description:
        "Notre équipe est là pour vous aider sur tout ce qui concerne votre commande ou votre expérience VOLREP.",
      emailLabel: "E-mail",
      emailBody: "Écrivez-nous à tout moment et un membre de notre équipe vous répondra.",
      emailCta: "Contacter l’assistance",
      topicsHeading: "Ce pour quoi nous pouvons vous aider",
      topics: ["Commandes", "Livraison", "Retours", "Questions produit", "Assistance générale"],
    },
    supportCallout: {
      privacy: "Des questions sur cette politique ou vos informations ? Contactez-nous à",
      terms: "Des questions sur ces conditions ? Contactez-nous à",
      returns: "Prêt à effectuer un retour, ou une question d’abord ? Écrivez-nous à",
      shipping: "Des questions sur votre livraison ? Contactez notre équipe à",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Backend enum → French label
// ---------------------------------------------------------------------------

// The backend's GET /api/orders/track returns an already-"humanized" English
// status string (e.g. "Pending Payment"), derived from the order_status enum
// in volrep-backend. We can't change that contract here, so this maps both
// the humanized English forms AND the raw enum values to French. Unknown
// values pass through unchanged.
const ORDER_STATUS_FR: Record<string, string> = {
  pendingpayment: "Paiement en attente",
  paid: "Payée",
  fulfilled: "Expédiée",
  partiallyfulfilled: "Partiellement expédiée",
  canceled: "Annulée",
  cancelled: "Annulée",
  refunded: "Remboursée",
  partiallyrefunded: "Partiellement remboursée",
};

export function orderStatusLabel(status: string): string {
  const key = status.toLowerCase().replace(/[\s_-]+/g, "");
  return ORDER_STATUS_FR[key] ?? status;
}
