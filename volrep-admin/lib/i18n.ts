// ---------------------------------------------------------------------------
// Volrep Admin — French UI dictionary (single source of truth for copy)
//
// The admin and the storefront are French-only. There is no locale routing
// and no runtime locale switch: every user-facing string lives here as
// professional French, and screens/components import `t` (static copy) or
// the enum-label helpers (backend enum values → French).
//
// RULES for future work (Phase 7C-0 onward):
//  - Never hard-code a user-facing string in a component. Add a key here.
//  - Keep keys grouped by screen/feature. Interpolated strings are functions.
//  - Backend enum values are translated through the *Label() helpers below,
//    never shown raw. `humanize()` in lib/format stays only as a last-resort
//    fallback for genuinely unknown strings (e.g. new audit actions).
//  - Technical identifiers (API paths, DB fields, SKUs, handles, env vars,
//    country/currency codes) are NOT translated.
// ---------------------------------------------------------------------------

import type {
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  ReviewStatus,
  Role,
} from "@/lib/types";

/** French pluralement: 0 and 1 take the singular. */
export function plural(n: number, one: string, many: string): string {
  return Math.abs(n) <= 1 ? one : many;
}

export const t = {
  common: {
    appName: "VOLREP Admin",
    brand: "VOLREP",
    loading: "Chargement…",
    save: "Enregistrer",
    saved: "Enregistré.",
    saveChanges: "Enregistrer les modifications",
    cancel: "Annuler",
    close: "Fermer",
    confirm: "Confirmer",
    apply: "Appliquer",
    edit: "Modifier",
    remove: "Retirer",
    delete: "Supprimer",
    add: "Ajouter",
    retry: "Réessayer",
    dash: "—",
    any: "Tous",
    all: "Tous",
    yes: "Oui",
    no: "Non",
    none: "Aucun",
    previous: "Précédent",
    next: "Suivant",
    nothingHere: "Rien pour le moment",
    genericError: "Une erreur est survenue.",
    actionFailed: "L’action a échoué. Veuillez réessayer.",
    networkError: "Impossible de joindre le serveur. Vérifiez que le backend est démarré.",
    requestFailed: (status: number) => `La requête a échoué (${status}).`,
    sessionExpired: "Votre session a expiré. Veuillez vous reconnecter.",
    commaSeparated: "Séparés par des virgules",
    ownerOnly: "Réservé au propriétaire",
    dismiss: "Fermer la notification",
  },

  nav: {
    fallbackTitle: "Admin",
    groups: {
      store: "Boutique",
      catalog: "Catalogue",
      settings: "Paramètres",
    },
    items: {
      dashboard: "Tableau de bord",
      orders: "Commandes",
      analytics: "Analytics",
      products: "Produits",
      homepage: "Page d’accueil",
      reviews: "Avis",
      shipping: "Livraison",
      audit: "Journal d’audit",
      settings: "Paramètres",
      integrations: "Intégrations",
    },
  },

  sidebar: {
    tagline: "Centre de contrôle",
    localEnv: "Environnement local",
  },

  topbar: {
    openMenu: "Ouvrir le menu",
    expandSidebar: "Déplier le menu latéral",
    collapseSidebar: "Replier le menu latéral",
    accountSuffix: (role: string) => `Compte ${role.toLowerCase()}`,
    signOut: "Se déconnecter",
    signOutConfirmTitle: "Se déconnecter ?",
    signOutConfirmBody: "Vous devrez vous reconnecter pour accéder au tableau de bord.",
  },

  login: {
    heading: "Connexion à l’administration",
    email: "E-mail",
    password: "Mot de passe",
    submit: "Se connecter",
    invalidCredentials: "E-mail ou mot de passe incorrect.",
    tooManyAttempts: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  },

  authGate: {
    checkingSession: "Vérification de votre session…",
  },

  analytics: {
    title: "Analytics",
    subtitle: "Indicateurs de la boutique — agrégats en lecture seule",
    refresh: "Actualiser",
    loadError: "Impossible de charger les indicateurs.",
    period: {
      label: "Période",
      d7: "7 jours",
      d30: "30 jours",
      all: "Total",
    },
    periodNote: "Le chiffre d’affaires, le nombre de commandes et le top produits suivent la période. Le stock faible et les avis en attente sont l’état actuel.",
    kpi: {
      revenue: "Chiffre d’affaires",
      revenueHint: "Commandes payées (paiement encaissé), livraison incluse.",
      orders: "Commandes",
      ordersHint: "Commandes créées sur la période, tous statuts.",
      lowStock: "Stock faible",
      lowStockHint: (n: number) => `Seuil : ${n} unités ou moins`,
      pendingReviews: "Avis en attente",
    },
    topProducts: {
      title: "Top produits",
      subtitle: "Par chiffre d’affaires sur la période",
      empty: "Aucune vente sur cette période",
      columns: {
        product: "Produit",
        units: "Unités",
        revenue: "CA",
      },
    },
    lowStock: {
      title: "Stock faible",
      subtitle: "Informatif — Volrep ne modifie jamais le stock",
      empty: "Aucun produit sous le seuil",
      managedElsewhere: "Le stock est géré dans le système COD.",
      columns: {
        product: "Produit",
        variant: "Variante",
        sku: "SKU",
        stock: "Stock",
      },
    },
    pendingReviews: {
      title: "Avis en attente",
      empty: "File de modération vide",
      count: (n: number) => `${n} avis en attente de modération`,
      moderate: "Modérer →",
    },
  },

  dashboard: {
    title: "Tableau de bord",
    subtitle: "Vue d’ensemble de l’activité du magasin",
    refresh: "Actualiser",
    stat: {
      ordersToday: "Commandes du jour",
      pendingPayment: "Paiement en attente",
      cashOnDelivery: "Paiement à la livraison",
      processing: "En préparation",
      paidNotShipped: "Payées, non expédiées",
      fulfilled: "Expédiées",
      revenue30d: "Chiffre d’affaires · 30 j",
      todaySuffix: (amount: string) => `${amount} aujourd’hui`,
      pendingReviews: "Avis en attente",
    },
    attention: {
      title: "Commandes à traiter",
      summary: (awaiting: string, toFulfil: string) =>
        `${awaiting} en attente de paiement · ${toFulfil} à expédier`,
      viewAll: "Tout voir →",
      emptyTitle: "Rien à traiter",
      emptyHint: "Aucune commande récente n’attend un paiement ou une expédition.",
      awaitingCod: "Paiement à la livraison en attente",
      needsFulfilment: "À expédier",
    },
    recentOrders: {
      title: "Commandes récentes",
      viewAll: "Tout voir →",
      empty: "Aucune commande",
    },
    pendingReviews: {
      title: "Avis en attente",
      moderate: "Modérer →",
      empty: "File de modération vide",
    },
  },

  orders: {
    title: "Commandes",
    subtitle: "Vue lecture seule pour le contexte boutique — les plus récentes en premier",
    readOnlyNotice:
      "Lecture seule. La confirmation, la préparation, la livraison et le suivi client se gèrent dans le système COD.",
    filters: {
      status: "Statut",
      orderNumber: "Numéro de commande",
      email: "E-mail",
      from: "Du",
      to: "Au",
      orderNumberPlaceholder: "#1001",
      emailPlaceholder: "client@exemple.com",
      apply: "Filtrer",
      clear: "Réinitialiser",
    },
    columns: {
      order: "Commande",
      customer: "Client",
      status: "Statut",
      payment: "Paiement",
      total: "Total",
      date: "Date",
    },
    itemCount: (n: number) => `${n} ${plural(n, "article", "articles")}`,
    emptyFiltered: "Aucune commande ne correspond à ces filtres",
    detail: {
      title: (orderNumber: string) => `Commande ${orderNumber}`,
      placedOn: (date: string) => `Passée le ${date}`,
      backToList: "← Toutes les commandes",
      lineItems: "Articles",
      colProduct: "Produit",
      colQty: "Qté",
      colUnit: "Unitaire",
      colTotal: "Total",
      subtotal: "Sous-total",
      shipping: "Livraison",
      discount: "Remise",
      total: "Total",
      customer: "Client",
      email: "E-mail",
      phone: "Téléphone",
      shippingAddress: "Adresse de livraison",
      payment: "Paiement",
      method: "Moyen",
      status: "Statut",
      paidAt: "Payée le",
      reference: "Référence",
      currentStatus: "Statut actuel",
      statusReadOnly: "Le statut est piloté par le système COD.",
    },
    cod: {
      title: "Opérations de commande",
      body: "La confirmation client, la préparation, la livraison et le suivi sont gérés dans le système COD.",
      cta: "Gérer dans le système COD",
      notConfigured: "L’URL du système COD n’est pas encore configurée (Paramètres › Intégrations).",
    },
  },

  products: {
    title: "Produits",
    subtitle: "Catalogue",
    newProduct: "Nouveau produit",
    filterStatus: "Statut",
    statusOptions: {
      draft: "Brouillon",
      active: "Actif",
      archived: "Archivé",
    },
    emptyTitle: "Aucun produit",
    emptyHintCanCreate: "Créez votre premier produit pour commencer.",
    columns: {
      product: "Produit",
      status: "Statut",
      variants: "Variantes",
      type: "Type",
      updated: "Modifié",
    },
    new: {
      title: "Nouveau produit",
      backToList: "← Produits",
      ownerRequiredTitle: "Accès propriétaire requis",
      ownerRequiredHint: "Seuls les comptes propriétaire peuvent créer des produits.",
      details: "Détails",
      titleField: "Titre",
      handle: "Identifiant d’URL",
      handleHint: "Minuscules, chiffres et traits d’union simples. Utilisé dans l’URL de la boutique.",
      description: "Description",
      productType: "Type de produit",
      status: "Statut",
      tags: "Étiquettes",
      tagsPlaceholder: "recovery, best-seller",
      create: "Créer le produit",
    },
    detail: {
      meta: (handle: string, date: string) => `/${handle} · modifié le ${date}`,
      backToList: "← Produits",
    },
    tabs: {
      info: "Informations",
      pricing: "Prix",
      media: "Médias",
      content: "Contenu",
      seo: "SEO",
    },
    unsaved: {
      badge: "Modifications non enregistrées",
      leaveTitle: "Quitter sans enregistrer ?",
      leaveBody: "Des modifications ne sont pas enregistrées. Elles seront perdues si vous quittez.",
      leaveConfirm: "Quitter sans enregistrer",
      stay: "Rester",
    },
    toast: {
      saved: "Modifications enregistrées",
      saveError: "L’enregistrement a échoué",
      uploaded: "Image importée",
      uploadError: "L’import a échoué",
      imageDeleted: "Image supprimée",
      primarySet: "Image principale mise à jour",
      reordered: "Ordre des images mis à jour",
    },
    form: {
      title: "Détails du produit",
      titleField: "Titre",
      description: "Description",
      productType: "Type de produit",
      status: "Statut",
      tags: "Étiquettes",
    },
    info: {
      title: "Informations générales",
      titleField: "Titre du produit",
      subtitle: "Accroche",
      subtitleHint: "Phrase courte affichée sous le titre. Conservée comme métadonnée produit.",
      handle: "Identifiant d’URL (handle)",
      handleHint: "Minuscules, chiffres et traits d’union simples.",
      handleChangeWarning:
        "Vous modifiez l’URL d’un produit existant. Les liens et partages pointant vers l’ancienne adresse cesseront de fonctionner.",
      handleInvalid: "Minuscules, chiffres et traits d’union simples uniquement.",
      productType: "Type de produit",
      status: "Statut",
      statusHint: (ownerOnly: boolean) =>
        "Contrôle la visibilité du produit sur la boutique Volrep. N’affecte pas les pages marketing Lirya." +
        (ownerOnly ? " Réservé au propriétaire." : ""),
      tags: "Étiquettes",
      save: "Enregistrer les informations",
    },
    pricing: {
      title: "Prix par variante",
      subtitle: "Le prix et le prix barré sont enregistrés côté serveur. Le prix barré doit être supérieur au prix de vente.",
      colVariant: "Variante",
      colPrice: "Prix de vente",
      colCompareAt: "Prix barré",
      colDiscount: "Remise",
      price: "Prix de vente",
      compareAt: "Prix barré",
      currency: "Devise",
      noDiscount: "—",
      discountBadge: (pct: number) => `−${pct} %`,
      onSale: "En promotion",
      save: "Enregistrer le prix",
      empty: "Ajoutez une variante ci-dessus pour définir un prix.",
      priceInvalid: "Le prix doit être un nombre positif avec au plus 2 décimales.",
      priceRequired: "Le prix est obligatoire.",
      compareAtInvalid: "Le prix barré doit être un nombre positif avec au plus 2 décimales.",
      compareAtNotAbovePrice: "Le prix barré doit être strictement supérieur au prix de vente.",
    },
    media: {
      title: "Médias du produit",
      subtitle: "Importez des images hébergées par Volrep. La première image est l’image principale.",
      upload: "Importer une image",
      uploading: "Import en cours…",
      dropHint: "JPEG, PNG, WebP ou AVIF · 10 Mo maximum",
      empty: "Aucune image. Importez la première image du produit.",
      primary: "Principale",
      makePrimary: "Définir comme principale",
      moveUp: "Monter",
      moveDown: "Descendre",
      delete: "Supprimer",
      deleteTitle: "Supprimer cette image ?",
      deleteBody: "L’image sera retirée du produit. Cette action est définitive.",
      altText: "Texte alternatif",
      altPlaceholder: "Décrivez l’image (accessibilité, SEO)",
      saveAlt: "Enregistrer",
      externalBadge: "URL externe",
      externalNote: "Image héritée hébergée hors de Volrep — supprimez-la après avoir importé un remplacement.",
      ownedNote: "Hébergée par Volrep",
      sizeKb: (kb: number) => `${kb} Ko`,
    },
    options: {
      title: "Options",
      subtitle: "Les options définissent les déclinaisons vendables (ex. Couleur : Noir, Blanc).",
      add: "Ajouter une option",
      empty: "Aucune option. Les produits à variante unique n’en ont pas besoin.",
      emptyShort: "Aucune option — ce produit a une seule variante.",
      name: "Nom",
      values: "Valeurs",
      namePlaceholder: "Couleur",
      valuesPlaceholder: "Noir, Blanc",
      save: "Enregistrer les options",
    },
    images: {
      title: "Images",
      add: "Ajouter une URL d’image",
      uploadNotice:
        "L’import de fichiers n’est pas encore disponible — collez des URL d’images hébergées. La première image est celle mise en avant.",
      empty: "Aucune image.",
      urlLabel: (n: number) => `URL n°${n}`,
      altText: "Texte alternatif",
      save: "Enregistrer les images",
    },
    variants: {
      title: "Variantes",
      subtitle: "Options, prix, prix barré, disponibilité et stock — toute la gestion des déclinaisons du produit.",
      add: "Ajouter une variante",
      colVariant: "Variante",
      colSku: "SKU",
      colPrice: "Prix de vente",
      colCompareAt: "Prix barré",
      colForSale: "En vente",
      colStock: "Stock",
      empty: "Aucune variante pour le moment.",
      stockNotice:
        "Le stock est indiqué à titre informatif — il est géré dans le système COD.",
      forSaleToggleLabel: (title: string) => `Disponible à la vente — variante « ${title} »`,
      forSaleOn: "Variante disponible à la vente",
      forSaleOff: "Variante retirée de la vente",
      delete: "Supprimer",
      deleteTitle: (title: string) => `Supprimer la variante « ${title} » ?`,
      deleteBody: (title: string) =>
        `La variante « ${title} » sera définitivement supprimée. Cette action est irréversible. Les commandes déjà passées ne sont pas affectées.`,
      deleteConfirm: "Confirmer la suppression",
      deleteLastBlocked:
        "Impossible de supprimer la dernière variante d’un produit. Ajoutez une autre variante avant de supprimer celle-ci.",
      deleteInCartTitle: "Suppression impossible",
      deleteInCartExplain:
        "Cette variante ne peut pas être supprimée car elle est utilisée dans un panier actif.",
      deleteInCartAfter: "Vous pouvez la désactiver de la vente à la place.",
      deleteInCartAction: "Désactiver la vente",
      dialog: {
        editTitle: (title: string) => `Modifier la variante « ${title} »`,
        addTitle: "Ajouter une variante",
        saveEdit: "Enregistrer",
        saveCreate: "Valider",
        titleField: "Titre",
        sku: "SKU",
        price: "Prix de vente",
        compareAt: "Prix barré (facultatif)",
        currency: "Devise",
        availableForSale: "Disponible à la vente",
        optionPlaceholder: "Choisir…",
        optionRequired: "Choisissez une valeur pour chaque option.",
        titleRequired: "Le titre est obligatoire.",
        duplicateCombo: "Une variante avec cette combinaison d’options existe déjà.",
        priceInvalid: "Le prix doit être un nombre avec au plus 2 décimales.",
        compareAtInvalid: "Le prix barré est invalide.",
        compareAtNotAbovePrice: "Le prix barré doit être strictement supérieur au prix de vente.",
      },
    },
  },

  // ---- Product Studio (Phase 7C-3) -----------------------------------
  studio: {
    tabs: {
      overview: "Vue d’ensemble",
      info: "Informations",
      media: "Médias",
      page: "Page produit",
      landingPages: "Pages marketing",
    },
    unsaved: {
      badge: "Modifications non enregistrées",
      leaveTitle: "Quitter sans enregistrer ?",
      leaveBody: "Des modifications ne sont pas enregistrées. Elles seront perdues si vous changez d’onglet.",
      leaveConfirm: "Quitter sans enregistrer",
      stay: "Rester",
    },
    toast: {
      saved: "Modifications enregistrées",
      saveError: "L’enregistrement a échoué",
    },
    saveBar: {
      unsaved: "Modifications non enregistrées",
      saved: "À jour",
    },
    page: {
      title: "Page produit",
      subtitle:
        "Contenu, ordre et visibilité de la page produit du site. Le formulaire de commande, le panier et le paiement ne sont pas modifiables ici.",
      loading: "Chargement de la page…",
      // ---- draft / published status ----
      statusPublished: "Publiée",
      statusNeverPublished: "Jamais publiée",
      draftUpToDate: "Brouillon identique à la version en ligne",
      draftAhead: "Le brouillon contient des modifications non publiées",
      lastPublished: (when: string) => `Publiée ${when}`,
      neverPublishedHint:
        "La page du site affiche le contenu par défaut (identique à l’actuel) tant que rien n’a été publié.",
      invalidDraft:
        "Le brouillon enregistré n’est pas valide et ne peut pas être publié. Corrigez les champs signalés.",
      // ---- actions ----
      saveDraft: "Enregistrer le brouillon",
      publish: "Publier",
      publishConfirmTitle: "Publier la page produit ?",
      publishConfirmBody:
        "Le brouillon actuel remplacera la page visible par les clients. Cette action est immédiate.",
      publishBlockedDirty: "Enregistrez le brouillon avant de publier.",
      revert: "Rétablir le brouillon",
      revertConfirmTitle: "Rétablir le brouillon ?",
      revertConfirmBody:
        "Le brouillon sera remplacé par la version publiée (ou par le contenu par défaut si rien n’est publié). Les modifications non publiées seront perdues.",
      preview: "Aperçu",
      previewOpening: "Ouverture de l’aperçu…",
      previewDirtyHint: "L’aperçu montre le dernier brouillon enregistré, pas les modifications en cours.",
      toast: {
        draftSaved: "Brouillon enregistré",
        draftSaveError: "Échec de l’enregistrement du brouillon",
        published: "Page publiée",
        publishError: "Échec de la publication",
        reverted: "Brouillon rétabli",
        revertError: "Échec du rétablissement",
        previewError: "Impossible d’ouvrir l’aperçu",
      },
      // ---- section list ----
      sectionsHeading: (n: number) => `${n} section${n > 1 ? "s" : ""}`,
      hiddenTag: "Masquée",
      dragHint: "Glissez pour réordonner, ou utilisez Monter / Descendre.",
      moveUp: "Monter",
      moveDown: "Descendre",
      edit: "Éditer",
      close: "Fermer",
      show: "Afficher",
      hide: "Masquer",
      duplicate: "Dupliquer",
      delete: "Supprimer",
      deleteConfirmTitle: "Supprimer cette section ?",
      deleteConfirmBody: (label: string) =>
        `La section « ${label} » sera retirée de la page. Vous pouvez enregistrer le brouillon sans la publier immédiatement.`,
      // ---- shared editor labels ----
      fields: {
        heading: "Titre",
        subtitle: "Sous-titre",
        title: "Titre",
        text: "Texte",
        label: "Libellé",
        icon: "Icône (emoji)",
        badge: "Badge",
        disclaimer: "Mention légale",
        priceTokenHint: "Utilisez {price} pour insérer le prix du produit.",
        emphasisHint: "**gras**, *italique*, retour à la ligne = nouvelle ligne.",
        paragraphs: "Paragraphes",
        addParagraph: "Ajouter un paragraphe",
        items: "Éléments",
        addItem: "Ajouter",
        remove: "Retirer",
        question: "Question",
        answer: "Réponse",
        defaultOpen: "Élément ouvert par défaut (index, -1 = aucun)",
        tags: "Étiquettes (séparées par une virgule)",
        // hero
        features: "Points forts (icône + libellé)",
        guarantees: "Garanties (icône + texte)",
        guaranteeBox: "Encadré garantie",
        beforeAfter: "Bloc avant / après",
        beforeAfterEnabled: "Afficher le bloc avant / après",
        beforeLabel: "Libellé « avant »",
        afterLabel: "Libellé « après »",
        zones: "Zones (nom + visuel)",
        zoneName: "Nom de la zone",
        reviewsFallbackLabel: "Libellé quand il n’y a pas encore d’avis",
        reviewsCountSuffix: "Suffixe du compteur d’avis",
        ctaLabel: "Libellé du bouton principal",
        ctaSubtext: "Texte sous le bouton",
        ctaSubtextSmall: "Petit texte sous le bouton",
        // reviews
        maxCount: "Nombre maximum d’avis affichés",
        emptyText: "Texte affiché sans avis",
        reviewsNote:
          "Les avis affichés proviennent des avis clients réels et se modèrent dans l’onglet Avis. Aucun avis ne se saisit ici.",
        // comparison
        productName: "Nom du produit (colonne)",
        comparisonImage: "Image du produit",
        comparisonImageHint:
          "Affichée au-dessus du tableau. Vide : l’image principale du produit est utilisée automatiquement.",
        competitors: "Colonnes concurrentes",
        rows: "Lignes de comparaison",
        rowLabel: "Intitulé de la ligne",
        stateYes: "Oui",
        stateNo: "Non",
        statePartial: "Partiel",
        // professionals
        labels: "Libellés",
        // problem/solution
        warningIcon: "Icône d’avertissement",
        warningText: "Texte d’avertissement",
        problems: "Problèmes (icône + titre + texte)",
        solutionLabel: "Libellé de la flèche « solution »",
        solution: "Encadré solution",
        // endorsement
        avatar: "Avatar (emoji)",
        quote: "Citation",
        name: "Signature",
        proTip: "Encadré « conseil »",
        // order
        orderNote: "Seuls le titre et le sous-titre au-dessus du formulaire sont modifiables ici.",
        // ugc / media
        videoSlots: "Emplacements vidéo",
        posterUrl: "Image d’aperçu (URL, optionnel)",
      },
      // ---- media field ----
      media: {
        current: "Visuel actuel",
        placeholder: "Emplacement vide (« visuel à venir »)",
        placeholderLabel: "Texte de l’emplacement vide",
        fromImage: "Image du produit",
        fromUrl: "URL externe",
        choose: "Choisir un visuel",
        chooseVideo: "Ajouter une vidéo",
        change: "Changer",
        replace: "Remplacer",
        remove: "Supprimer",
        clear: "Vider (remettre l’emplacement)",
        videoBadge: "Vidéo",
        gifBadge: "GIF",
        isVideo: "Fichier vidéo (MP4)",
        isGif: "GIF animé",
        pickerTitle: "Choisir un visuel",
        sectionOnlyNote:
          "Choisir ou téléverser ici ne modifie jamais la galerie du produit. « Galerie du produit » réutilise une image déjà présente dans la galerie ; « Téléverser » et « URL externe » ajoutent un visuel propre à cette section.",
        tabProduct: "Galerie du produit",
        tabUrl: "URL externe",
        tabUpload: "Téléverser",
        tabNone: "Aucun",
        noProductImages: "Ce produit n’a pas encore d’image de galerie. Téléversez-en une ou saisissez une URL.",
        urlHint: "Lien direct vers une image (jpg, png, webp, avif).",
        urlHintGif: "Lien direct vers une image ou un GIF animé. Un .gif est traité comme un GIF animé.",
        urlHintVideo: "Lien direct vers un fichier MP4, un GIF animé ou une image. Le type est détecté depuis l’extension.",
        urlPlaceholder: "https://…",
        altText: "Texte alternatif",
        uploadHint:
          "Déposez une image ou cliquez pour parcourir (JPEG, PNG, WebP, AVIF). Utilisée uniquement dans cette section — pas ajoutée à la galerie du produit.",
        uploadHintGif:
          "Déposez une image ou un GIF animé (JPEG, PNG, WebP, AVIF, GIF) ou cliquez pour parcourir. Le GIF garde son animation. Utilisé uniquement dans cette section — jamais ajouté à la galerie du produit.",
        uploadHintVideo:
          "Déposez une vidéo MP4, un GIF animé ou une image, ou cliquez pour parcourir. Utilisé uniquement dans cette section — jamais ajouté à la galerie du produit.",
        select: "Sélectionner",
        uploadSuccess: "Fichier téléversé",
        uploadError: "Échec du téléversement",
      },
    },
    info: {
      groupIdentity: "Identité",
      groupIdentityHint: "Nom, accroche, identifiant d’URL et classification du produit.",
      groupDescription: "Description",
      groupDescriptionHint: "Texte de référence du produit. Le contenu marketing détaillé se gère dans Lirya.",
      groupVariants: "Variantes",
      groupVariantsHint: "Options, prix, disponibilité et stock des déclinaisons du produit.",
      groupPricing: "Prix",
      groupPricingHint: "Prix de vente et prix barré, par variante.",
    },
    overview: {
      title: "Vue d’ensemble",
      subtitle: "État de la préparation de la fiche produit",
      openTab: "Ouvrir",
      priceLabel: "Prix",
      compareAtLabel: "Prix barré",
      noPrice: "Aucun prix",
      variantsLabel: "Variantes",
      variantsValue: (n: number) => `${n} ${plural(n, "variante", "variantes")}`,
      optionsValue: (names: string) => (names ? `Options : ${names}` : "Aucune option"),
      stockLabel: "Stock indicatif",
      stockValue: (n: number) => `${n} ${plural(n, "unité", "unités")} — géré dans le système COD`,
      statusLabel: "Publication",
      noImage: "Aucune image",
      readinessLabel: "Préparation à la vente",
      readyTitle: "Prêt à vendre",
      readyBody: "Le produit a un prix et au moins une image : il peut être vendu sur sa fiche produit Volrep.",
      notReadyTitle: (n: number) => `${n} ${plural(n, "élément à compléter", "éléments à compléter")}`,
      notReadyBody: "Complétez le prix et les images pour pouvoir vendre ce produit.",
      statusReady: "Prêt",
      statusPartial: "À compléter",
      statusEmpty: "Non configuré",
      statusInfo: "Pour information",
      cards: {
        identity: "Produit",
        media: "Médias",
        landingPages: "Pages marketing",
        commerce: "Publication",
      },
      cardHints: {
        identity: "Titre, variantes et options du produit.",
        media: "Les images du produit hébergées par Volrep.",
        landingPages: "Pages marketing Lirya associées au produit (facultatif).",
        commerce: "Prix des variantes et état de publication sur la boutique.",
      },
      media: {
        value: (total: number, owned: number) =>
          `${total} ${plural(total, "image", "images")} · ${owned} ${plural(owned, "hébergée par Volrep", "hébergées par Volrep")}`,
        none: "Aucune image",
      },
      landingPages: {
        none: "Aucune page marketing associée",
        some: (linked: number) => `${linked} ${plural(linked, "page marketing associée", "pages marketing associées")}`,
        verified: (verified: number, total: number) => `${verified}/${total} ${plural(total, "lien vérifié", "liens vérifiés")}`,
        needsAttention: "Une page nécessite une vérification",
      },
      commerce: {
        published: "Produit actif sur la boutique",
        draft: "Brouillon — non visible sur la boutique",
        archived: "Archivé",
        noVariants: "Aucune variante définie",
        noPrice: "Une variante n’a pas de prix",
      },
    },
    description: {
      title: "Description du produit",
      hint: "Texte de référence du produit, affiché sur la fiche produit de la boutique.",
      save: "Enregistrer la description",
    },
    landingPages: {
      title: "Pages marketing",
      subtitle: "Pages marketing Lirya associées à ce produit. Lirya reste la source du contenu ; Volrep ne stocke que le lien.",
      loading: "Chargement des pages marketing Lirya…",
      notConfigured: "Intégration Lirya non configurée",
      notConfiguredHint:
        "L’intégration Lirya doit être configurée dans Paramètres › Intégrations pour associer des pages marketing.",
      notConfiguredShort: "Configurez Lirya dans Paramètres › Intégrations.",
      empty: "Aucune page marketing associée",
      emptyHint: "Associez une page marketing Lirya publiée à ce produit.",
      associate: "Associer une page",
      associateMore: "Associer une autre page",
      listHeading: (n: number) => `${n} ${plural(n, "page marketing associée", "pages marketing associées")}`,
      unassociate: "Dissocier",
      unassociateTitle: "Dissocier cette page ?",
      unassociateBody:
        "Le lien entre ce produit et la page marketing Lirya sera retiré. La page elle-même n’est pas modifiée ni supprimée sur Lirya.",
      preview: "Aperçu",
      previewDisabled: "Aperçu indisponible : la page n’est pas publiée.",
      editInLirya: "Modifier le contenu dans Lirya ↗",
      editInLiryaHint: "Ouvre l’éditeur Lirya dans un nouvel onglet. Une authentification Lirya distincte peut être requise.",
      contentInLiryaNote:
        "Le contenu marketing (sections, textes, visuels, mise en page) se gère dans Lirya. Volrep contrôle le produit et son association à la page.",
      fields: {
        slug: "Slug",
        template: "Modèle",
        version: "Version",
        pageId: "Identifiant Lirya",
        updatedAt: "Mise à jour",
      },
      lastChecked: (rel: string) => `Dernière vérification ${rel}`,
      neverChecked: "Jamais vérifiée",
      linkVerified: "Lien vérifié",
      linkUnverified: "Le lien avec cette page Lirya n’est pas vérifié.",
      linkUnverifiedHint:
        "Lirya ne renvoie pas de référence produit correspondante pour cette page. Le lien fonctionne mais n’est pas confirmé des deux côtés.",
      draftWarning: "Cette page est un brouillon sur Lirya : elle n’est pas visible publiquement.",
      offlineWarning: "Cette page est hors ligne sur Lirya : elle n’est pas visible publiquement.",
      picker: {
        title: "Associer une page marketing Lirya",
        intro: "Pages marketing publiées sur Lirya. Filtrez par nom si nécessaire.",
        search: "Filtrer par nom",
        columns: { name: "Nom", slug: "Slug", status: "Statut", template: "Modèle", updatedAt: "Mise à jour" },
        role: "Rôle de la page",
        roleHint: "Un produit ne peut avoir qu’une seule page par rôle.",
        choose: "Associer",
        loadMore: "Charger plus",
        empty: "Aucune page marketing publiée trouvée sur Lirya.",
        unavailable: "Impossible de charger les pages Lirya pour le moment. Réessayez.",
        roleTaken: "Ce rôle est déjà attribué à une autre page. Choisissez-en un autre.",
        alreadyLinked: "Cette page Lirya est déjà associée à ce produit.",
        allRolesUsed: "Tous les rôles sont déjà utilisés. Dissociez une page pour en associer une autre.",
      },
      toast: {
        associated: "Page marketing associée",
        unassociated: "Page marketing dissociée",
        associateError: "L’association a échoué",
        unassociateError: "La dissociation a échoué",
      },
    },
    media: {
      title: "Médias du produit",
      subtitle: "Images hébergées par Volrep. La première image est l’image principale de la fiche.",
      chooseFile: "Choisir un fichier",
      dropHint: "JPEG, PNG, WebP ou AVIF · 10 Mo maximum · glisser-déposer accepté",
      primaryHint: "La première image sert d’image principale sur la boutique et dans les listes.",
      countLabel: (total: number, owned: number) =>
        `${total} ${plural(total, "image", "images")} · ${owned} ${plural(owned, "hébergée", "hébergées")} par Volrep`,
      primaryTag: "Image principale",
      state: {
        uploading: "Import en cours…",
        success: "Image importée",
        error: "L’import a échoué",
      },
    },
  },

  // ---- Homepage Studio (Step 2) -------------------------------------
  homepage: {
    title: "Page d’accueil",
    subtitle:
      "Contenu, ordre et visibilité des sections de la page d’accueil du site. Le design, la mise en page et les animations ne sont pas modifiables ici.",
    loading: "Chargement de la page d’accueil…",
    loadError: "Impossible de charger la page d’accueil.",

    tabs: {
      overview: "Vue d’ensemble",
      sections: "Sections",
      media: "Médias",
      bestSellers: "Meilleures ventes",
    },

    // ---- status ----
    statusPublished: "Publiée",
    statusNeverPublished: "Jamais publiée",
    statusDraftAhead: "Modifications non publiées",
    draftUpToDate: "Brouillon identique à la version en ligne",
    draftAhead: "Le brouillon contient des modifications non publiées",
    lastPublished: (when: string) => `Publiée ${when}`,
    neverPublishedHint:
      "La page d’accueil du site affiche le contenu actuel tant que rien n’a été publié depuis Homepage Studio.",
    invalidDraft:
      "Le brouillon enregistré n’est pas valide et ne peut pas être publié. Rétablissez la version publiée ou corrigez les champs.",
    lastDraftUpdate: (when: string) => `Brouillon modifié ${when}`,

    // ---- actions ----
    saveDraft: "Enregistrer le brouillon",
    saving: "Enregistrement…",
    publish: "Publier",
    publishBlockedDirty: "Enregistrez le brouillon avant de publier.",
    publishConfirmTitle: "Publier la page d’accueil ?",
    publishConfirmBody:
      "Le brouillon actuel deviendra la version publiée de la page d’accueil. La vitrine consommera ce document lors de l’étape de migration ; aucune modification visible pour les clients tant que cette étape n’est pas faite.",
    revert: "Rétablir la version publiée",
    revertConfirmTitle: "Rétablir le brouillon ?",
    revertConfirmBody:
      "Le brouillon sera remplacé par la version publiée (ou par le contenu par défaut si rien n’est publié). Les modifications non enregistrées et non publiées seront perdues.",
    preview: "Aperçu",
    previewOpening: "Ouverture de l’aperçu…",
    previewDirtyHint: "L’aperçu montre le dernier brouillon enregistré, pas les modifications en cours.",

    unsaved: "Modifications non enregistrées",
    unsavedLeaveTitle: "Quitter sans enregistrer ?",
    unsavedLeaveBody:
      "Des modifications du brouillon ne sont pas enregistrées. Elles seront perdues si vous quittez.",
    unsavedLeaveConfirm: "Quitter sans enregistrer",
    unsavedStay: "Rester",

    toast: {
      draftSaved: "Brouillon enregistré",
      draftSaveError: "Échec de l’enregistrement du brouillon",
      published: "Page d’accueil publiée",
      publishError: "Échec de la publication",
      reverted: "Brouillon rétabli",
      revertError: "Échec du rétablissement",
      previewError: "Impossible d’ouvrir l’aperçu",
    },

    // ---- overview ----
    overview: {
      title: "Vue d’ensemble",
      publicationStatus: "Statut de publication",
      lastDraftUpdate: "Dernière modification du brouillon",
      lastPublication: "Dernière publication",
      neverPublished: "Jamais publiée",
      sectionCount: "Sections",
      sectionCountValue: (total: number, enabled: number) => `${enabled}/${total} affichées`,
      mediaCount: "Médias du site",
      mediaCountValue: (n: number) => `${n} ${plural(n, "fichier", "fichiers")}`,
      unpublishedChanges: "Modifications non publiées",
      hasUnpublished: "Oui",
      noUnpublished: "Non",
      unsavedLocal: "dont des modifications non enregistrées",
      note: "Homepage Studio ne fournit que des indicateurs. Aucune analyse, aucune métrique de trafic.",
    },

    // ---- sections list ----
    sections: {
      title: "Sections de la page d’accueil",
      subtitle:
        "Les 9 sections de la page d’accueil. Réordonnez-les et affichez/masquez-les. Le contenu de chaque section se modifie via « Éditer ». Aucune section ne peut être ajoutée ou supprimée.",
      dragHint: "Glissez pour réordonner, ou utilisez Monter / Descendre.",
      moveUp: "Monter",
      moveDown: "Descendre",
      edit: "Éditer",
      close: "Fermer",
      show: "Afficher la section",
      hide: "Masquer la section",
      hiddenTag: "Masquée",
      hiddenNote: "Cette section reste dans le document, son contenu est conservé.",
      count: (n: number) => `${n} sections`,
      hiddenCount: (n: number) => `${n} masquée${n > 1 ? "s" : ""}`,
    },

    // ---- section display labels (admin only — describe each section) ----
    sectionLabels: {
      hero: "Hero",
      bestSellers: "Meilleures ventes",
      recoveryPhilosophy: "La philosophie de récupération",
      recoverEverywhere: "Récupérez partout",
      whyVolrep: "Pourquoi VOLREP ?",
      testimonials: "Témoignages",
      faq: "Questions fréquentes",
      finalCta: "CTA final",
      newsletter: "Newsletter",
    },
    sectionDescriptions: {
      hero: "Titre, accroche, deux boutons et le visuel produit.",
      bestSellers: "Titre + carrousel des produits du catalogue.",
      recoveryPhilosophy: "Bloc éditorial bleu avec photo de fond et bouton.",
      recoverEverywhere: "Cinq cartes de zones de récupération avec image.",
      whyVolrep: "Quatre points forts + quatre statistiques.",
      testimonials: "Trois témoignages, note et bandeaux de réassurance.",
      faq: "Accordéon de six questions fréquentes.",
      finalCta: "Section sombre, deux boutons, note et badges de réassurance.",
      newsletter: "Titre, texte et formulaire e-mail (le formulaire reste inchangé).",
    },

    // ---- shared editor field labels ----
    fields: {
      eyebrow: "Sur-titre",
      eyebrowHint: "Le préfixe « VOLREP™ » est ajouté automatiquement par le site.",
      heading: "Titre",
      headingMultilineHint: "Un retour à la ligne dans ce champ = un saut de ligne sur le site.",
      body: "Texte",
      subtitle: "Sous-titre",
      ctaLabel: "Libellé du bouton",
      ctaHref: "Lien du bouton",
      ctaHrefHint: "Chemin interne (/products/…), ancre (#…) ou URL http(s).",
      primaryCta: "Bouton principal",
      secondaryCta: "Bouton secondaire",
      cta: "Bouton",
      altText: "Texte alternatif",
      caption: "Légende",
      badge: "Badge",
      productName: "Nom du produit",
      visual: "Visuel",
      background: "Image de fond",
      objectPosition: "Cadrage de l’image (classe CSS)",
      span: "Largeur dans la grille (classe CSS)",
      cssTokenHint: "Valeur technique reprise du site — ne la modifiez que si vous savez ce que vous faites.",
      zoneTitle: "Titre de la zone",
      zoneDescription: "Description de la zone",
      zone: (n: number) => `Zone ${n}`,
      feature: (n: number) => `Point fort ${n}`,
      featureNumber: "Numéro",
      featureTitle: "Titre",
      featureDescription: "Description",
      featureIcon: "Icône",
      stat: (n: number) => `Statistique ${n}`,
      statValue: "Valeur (nombre)",
      statSuffix: "Suffixe",
      statLabel: "Libellé",
      ratingStars: "Étoiles (symboles)",
      ratingLabel: "Libellé de la note",
      ratingDescription: "Précision sous la note",
      verifiedLabel: "Libellé « client vérifié »",
      testimonial: (n: number) => `Témoignage ${n}`,
      testimonialName: "Nom",
      testimonialQuote: "Citation",
      trustlineRating: "Note (bandeau)",
      trustlineLabel: "Libellé du bandeau",
      trustlineAudiences: "Publics (séparés par une virgule)",
      trustItem: (n: number) => `Chiffre de réassurance ${n}`,
      trustItemValue: "Valeur",
      trustItemLabel: "Libellé",
      question: "Question",
      answer: "Réponse",
      faqItem: (n: number) => `Question ${n}`,
      defaultOpen: "Question ouverte par défaut (index, -1 = aucune)",
      badgeItem: (n: number) => `Badge ${n}`,
      badgeIcon: "Icône",
      badgeLabel: "Libellé",
      emailLabel: "Libellé du champ e-mail",
      emailPlaceholder: "Texte indicatif du champ e-mail",
      submitLabel: "Libellé du bouton d’inscription",
      successMessage: "Message de confirmation",
      newsletterNote:
        "Seuls les textes sont modifiables. Le fonctionnement du formulaire (envoi, API) n’est pas modifié.",
      lockedListNote:
        "Le nombre et l’ordre des éléments sont figés pour cette version — seul leur contenu est modifiable.",
      whyIcons: {
        shield: "Bouclier",
        wave: "Onde",
        soundwave: "Onde sonore",
        check: "Coche",
      },
      badgeIcons: {
        truck: "Camion (livraison)",
        shield: "Bouclier (garantie)",
        return: "Retour",
      },
    },

    // ---- media picker + library ----
    media: {
      libraryTitle: "Médias du site",
      librarySubtitle:
        "Bibliothèque d’images, GIF et vidéos propre à la page d’accueil. Totalement séparée de la galerie des produits.",
      separationNote:
        "Ces fichiers vivent dans « site_media ». Ils ne sont jamais ajoutés à la galerie d’un produit, et une image de produit ne peut pas être utilisée ici.",
      uploadHint: "JPEG, PNG, WebP, AVIF, GIF animé ou MP4 · glisser-déposer accepté",
      empty: "Aucun média. Téléversez le premier fichier de la page d’accueil.",
      count: (n: number) => `${n} ${plural(n, "fichier", "fichiers")}`,
      dimensions: (w: number, h: number) => `${w} × ${h} px`,
      sizeKb: (kb: number) => `${kb} Ko`,
      uploadedOn: (date: string) => `Ajouté le ${date}`,
      delete: "Supprimer",
      deleteTitle: "Supprimer ce média ?",
      deleteBody:
        "Le fichier sera retiré de la bibliothèque du site. Les sections qui l’utilisaient afficheront un emplacement vide. Cette action est définitive.",
      deleted: "Média supprimé",
      deleteError: "La suppression a échoué",
      uploaded: "Fichier téléversé",
      uploadError: "Le téléversement a échoué",
      deduped: "Ce fichier était déjà dans la bibliothèque — l’existant a été réutilisé.",

      // slot field
      current: "Visuel actuel",
      placeholder: "Emplacement vide",
      placeholderLabel: "Texte de l’emplacement vide",
      fromLibrary: "Bibliothèque du site",
      fromUrl: "URL externe",
      isVideo: "Vidéo (MP4)",
      isGif: "GIF animé",
      isImage: "Image",
      gifBadge: "GIF",
      choose: "Choisir un visuel",
      replace: "Remplacer",
      remove: "Vider l’emplacement",
      pickerTitle: "Choisir un visuel pour la page d’accueil",
      pickerNote:
        "« Bibliothèque » et « Téléverser » utilisent les médias du site (site_media). La galerie des produits n’est jamais utilisée ici.",
      tabLibrary: "Bibliothèque",
      tabUrl: "URL externe",
      tabUpload: "Téléverser",
      tabNone: "Aucun",
      libraryEmpty: "La bibliothèque du site est vide. Téléversez un fichier ou saisissez une URL.",
      urlHint: "Lien direct vers une image, un GIF ou un MP4. Les URL Shopify existantes continuent de fonctionner.",
      urlPlaceholder: "https://…",
      select: "Sélectionner",
      uploading: "Téléversement…",
      chooseFile: "Choisir un fichier",
    },

    // ---- best sellers tab ----
    bestSellers: {
      title: "Configuration des meilleures ventes",
      subtitle:
        "La section « Meilleures ventes » affiche des produits du catalogue. Comportement actuel du site conservé à l’identique.",
      source: "Source",
      sourceCatalog: "Catalogue",
      sourceCatalogHint:
        "Le site affiche les produits renvoyés par l’API catalogue, dans l’ordre du backend. La sélection manuelle de produits n’est pas disponible dans cette version.",
      limit: "Nombre de produits",
      limitHint: "Entre 1 et 24.",
      headingsNote: "Le sur-titre, le titre et le texte de cette section se modifient dans l’onglet Sections.",
    },
  },

  reviews: {
    title: "Avis",
    subtitle: "Modération — seuls les avis approuvés apparaissent sur la boutique",
    tabs: {
      pending: "En attente",
      approved: "Approuvés",
      rejected: "Rejetés / dépubliés",
    },
    emptyByStatus: (status: ReviewStatus) => {
      const map: Record<ReviewStatus, string> = {
        pending: "Aucun avis en attente",
        approved: "Aucun avis approuvé",
        rejected: "Aucun avis rejeté",
      };
      return map[status];
    },
    verifiedPurchase: "Achat vérifié",
    noContactEmail: "aucun e-mail de contact",
    approve: "Approuver",
    unpublish: "Dépublier",
    reject: "Rejeter",
    moveToPending: "Remettre en attente",
  },

  shipping: {
    title: "Livraison",
    subtitle: "Tarif forfaitaire par pays de destination",
    addCountry: "Ajouter un pays",
    readOnlyNotice: "Lecture seule — la configuration de la livraison est réservée au propriétaire.",
    emptyTitle: "Aucun pays configuré",
    emptyHintCanWrite: "Ajoutez un pays pour activer le paiement depuis celui-ci.",
    columns: {
      country: "Pays",
      enabled: "Activé",
      flatRate: "Tarif forfaitaire",
      handling: "Traitement",
      shipping: "Acheminement",
      returns: "Retours",
    },
    enabled: "Activé",
    disabled: "Désactivé",
    daysRange: (min: number, max: number) => `${min}–${max} j`,
    returnWindow: (n: number) => `fenêtre de ${n} j`,
    dialog: {
      editTitle: (code: string) => `Modifier ${code}`,
      addTitle: "Ajouter un pays",
      countryCode: "Code pays",
      countryCodeHint: "ISO 3166-1 alpha-2",
      currency: "Devise",
      shippingEnabled: "Livraison activée",
      flatRate: "Tarif forfaitaire",
      handlingMin: "Traitement min (j)",
      handlingMax: "Traitement max (j)",
      shippingMin: "Acheminement min (j)",
      shippingMax: "Acheminement max (j)",
      returnWindow: "Fenêtre de retour (j)",
      refundProcessing: "Traitement du remboursement (j)",
      codeInvalid: "Le code pays doit comporter 2 lettres (ISO).",
    },
  },

  settings: {
    title: "Paramètres",
    subtitle: "Identité de la boutique dont Volrep est la source de vérité",
    readOnlyNotice: "Lecture seule — les paramètres de la boutique sont réservés au propriétaire.",
    loadError: "Impossible de charger les paramètres.",
    savedToast: "Paramètres enregistrés",
    savedToastBody: "Les modifications seront appliquées à la vitrine lors d’une prochaine étape.",
    groups: {
      identity: "Identité",
      social: "Réseaux sociaux",
    },
    identityHint:
      "Le nom, la tagline et l’e-mail de support. Le menu de navigation, le pied de page et le logo restent gérés dans le code de la vitrine pour l’instant.",
    socialHint: "URL complètes (https://…). Laissez vide pour masquer le lien.",
    fields: {
      storeName: "Nom de la boutique",
      tagline: "Tagline",
      taglineHint: "Phrase courte affichée à côté du nom.",
      supportEmail: "E-mail de support",
      supportEmailHint: "Utilisé pour les liens « Contact » de la vitrine.",
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
    },
    invalidEmail: "L’adresse e-mail de support n’est pas valide.",
    invalidUrl: "Le lien doit être une URL http(s) complète.",
  },

  integrations: {
    title: "Intégrations",
    subtitle: "Configuration des systèmes externes connectés à la boutique",
    loadError: "Impossible de charger l’état des intégrations.",
    statusConfigured: "Configuré",
    statusNotConfigured: "Non configuré",
    statusNotConnected: "Non connecté",
    serverConfigNote: "Ces réglages proviennent de la configuration serveur et ne sont pas modifiables ici.",
    lirya: {
      title: "Lirya — Pages marketing",
      description:
        "Liaison en lecture seule entre un produit Volrep et sa page marketing Lirya (portée « pages:read » uniquement).",
      apiUrl: "URL de l’API",
      apiKey: "Clé API (serveur)",
      apiKeyPresent: "Présente",
      apiKeyMissing: "Absente",
      adminUrl: "URL de l’éditeur Lirya",
      notSet: "Non défini",
      keyNeverShown: "La clé API n’est jamais transmise au navigateur ni affichée en entier.",
      notConfiguredHint:
        "Définissez LIRYA_API_BASE_URL et LIRYA_API_KEY côté serveur pour activer l’intégration.",
      testButton: "Tester la connexion",
      testing: "Test en cours…",
      testOk: (n: number) => `Connexion réussie — ${n} page(s) accessible(s).`,
      testFailed: "Échec de la connexion",
    },
    cod: {
      title: "Système COD",
      description:
        "Les opérations COD (confirmation, appels, livraison, suivi) vivent dans un système séparé. Volrep ne s’y connecte pas encore.",
      systemUrl: "URL du système COD",
      notConfiguredHint: "Renseignez NEXT_PUBLIC_COD_SYSTEM_URL pour activer les liens sortants depuis les commandes.",
      futureNote: "Emplacement réservé pour une future connexion — aucune donnée n’est échangée.",
    },
  },

  auditLog: {
    title: "Journal d’audit",
    subtitle: "Lecture seule — chaque modification d’un administrateur, en ajout seul",
    entityType: "Type d’entité",
    columns: {
      when: "Quand",
      admin: "Administrateur",
      action: "Action",
      entity: "Entité",
      details: "Détails",
    },
    empty: "Aucune entrée d’audit",
  },

  pagination: {
    noResults: "Aucun résultat",
    range: (from: number, to: number, total: number) => `${from}–${to} sur ${total}`,
    pageOf: (page: number, pages: number) => `Page ${page} / ${pages}`,
  },

  relative: {
    justNow: "à l’instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    days: (n: number) => `il y a ${n} j`,
  },
} as const;

// ---- Backend enum → French label helpers --------------------------------

export function orderStatusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    pending_payment: "Paiement en attente",
    paid: "Payée",
    fulfilled: "Expédiée",
    partially_fulfilled: "Partiellement expédiée",
    canceled: "Annulée",
    refunded: "Remboursée",
    partially_refunded: "Partiellement remboursée",
  };
  return map[status] ?? status;
}

export function paymentStatusLabel(status: PaymentStatus): string {
  const map: Record<PaymentStatus, string> = {
    pending: "En attente",
    paid: "Payé",
    refunded: "Remboursé",
  };
  return map[status] ?? status;
}

export function productStatusLabel(status: ProductStatus): string {
  const map: Record<ProductStatus, string> = {
    draft: "Brouillon",
    active: "Actif",
    archived: "Archivé",
  };
  return map[status] ?? status;
}

export function reviewStatusLabel(status: ReviewStatus): string {
  const map: Record<ReviewStatus, string> = {
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Rejeté",
  };
  return map[status] ?? status;
}

export function roleLabel(role: Role): string {
  return role === "owner" ? "Propriétaire" : "Personnel";
}

export function paymentProviderLabel(provider: string): string {
  const map: Record<string, string> = {
    cod: "Paiement à la livraison",
    cash_on_delivery: "Paiement à la livraison",
  };
  return map[provider] ?? provider;
}

// Lirya page status → French. Raw Lirya values are 'published' | 'hidden'
// | 'draft'; anything unknown falls through unchanged.
export function liryaStatusLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    published: "Publiée",
    hidden: "Hors ligne",
    draft: "Brouillon",
  };
  return status ? map[status] ?? status : "Inconnu";
}

// A Product ↔ Lirya binding role → French. Raw values are 'primary' |
// 'campaign' | 'ab_variant' | 'locale'; anything else falls through.
export function liryaRoleLabel(role: string | null | undefined): string {
  const map: Record<string, string> = {
    primary: "Principale",
    campaign: "Campagne",
    ab_variant: "Variante A/B",
    locale: "Locale",
  };
  return role ? map[role] ?? role : "—";
}

// A binding's sync_error code → a French sentence for the warning banner.
export function liryaSyncErrorLabel(code: string | null | undefined): string {
  const map: Record<string, string> = {
    page_not_found: "Page Lirya introuvable. Le lien est conservé.",
    unauthorized: "Accès à l’API Lirya refusé. Vérifiez la configuration.",
    insufficient_scope: "Autorisations Lirya insuffisantes. Vérifiez la configuration.",
    rate_limited: "Lirya a limité les requêtes. Les informations proviennent du cache.",
    unavailable: "Lirya est temporairement indisponible. Les informations proviennent du cache.",
  };
  return code ? map[code] ?? "Lirya est temporairement indisponible." : "";
}

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  admin_user: "Administrateur",
  product: "Produit",
  product_variant: "Variante de produit",
  order: "Commande",
  fulfillment: "Expédition",
  review: "Avis",
  shipping_settings: "Paramètres de livraison",
  landing_page: "Page marketing",
  homepage: "Page d’accueil",
  site_media: "Média du site",
};

export function auditEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}
