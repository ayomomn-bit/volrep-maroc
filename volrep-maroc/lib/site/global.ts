import { cache } from "react";
import type { FooterMenuColumn, GlobalShopData, NavLink, ShopLogo, SocialLink } from "@/lib/site/types";
import { getStoreSettings } from "@/lib/backend/site-settings";
import { t } from "@/lib/i18n";

// Global brand + navigation data for Header / Footer / MobileNav.
//
// History: Phase 2 identified this content as site-owned rather than
// commerce-owned; Phases 3–6 removed the dead Shopify Storefront round
// trip and froze the output here verbatim; Phase 7C localized every label
// to French. Structure, hrefs and anchor ids are unchanged.
//
// Phase 7C-5: the wordmark, tagline, support email and social links are
// now sourced from Volrep Store Settings (backend `store_settings`), with
// the constants below as field-by-field fallbacks. The logo, the
// navigation menus and the footer column structure remain fully
// code-owned — they are NOT read from Settings.

const SHOP_NAME = "VOLREP";

// TEMPORARY asset reference. The brand logo image is still hosted on the
// Shopify file CDN — the same interim situation as the product and
// lifestyle imagery elsewhere in this app (see next.config.ts). This is an
// asset URL, not a commerce dependency; migrating it to Volrep-owned
// storage is a later, separate task. Until then this is the exact URL the
// Storefront API returned, so the header logo renders identically.
const LOGO: ShopLogo = {
  type: "image",
  url: "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/ChatGPT_Image_Aug_8_2026_09_57_06_PM.png?v=1786385696",
  altText: null,
};

const MAIN_MENU: NavLink[] = [
  { href: "/", label: "Accueil" },
  { href: "/products/volrep-prm", label: "Boutique" },
  { href: "/#recovery-philosophy-heading", label: "Récupération" },
  { href: "/contact", label: "Contact" },
  { href: "/track-order", label: "Suivre ma commande" },
];

// The mobile drawer's link set is intentionally broader than the desktop bar.
const DRAWER_MENU: NavLink[] = [
  { href: "/products/volrep-prm", label: "Boutique" },
  { href: "/#why-volrep-heading", label: "Technologie" },
  { href: "/#recovery-philosophy-heading", label: "Récupération" },
  { href: "#", label: "À propos" },
  { href: "#", label: "Contact" },
  { href: "/#faq-heading", label: "FAQ" },
  { href: "/track-order", label: "Suivre ma commande" },
];

const FOOTER_MENU: FooterMenuColumn[] = [
  {
    title: "Boutique",
    links: [
      { href: "/products/volrep-prm", label: "Produits" },
      { href: "/#why-volrep-heading", label: "Technologie" },
      { href: "/#recovery-philosophy-heading", label: "Récupération" },
    ],
  },
  {
    title: "Aide",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/track-order", label: "Suivre ma commande" },
      { href: "/shipping", label: "Livraison" },
      { href: "/returns", label: "Retours" },
      { href: "/#faq-heading", label: "FAQ" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { href: "#", label: "À propos" },
      { href: "#", label: "Journal" },
      { href: "/privacy", label: "Confidentialité" },
      { href: "/terms", label: "Conditions" },
    ],
  },
];

const SOCIAL_LINKS: SocialLink[] = [
  { platform: "instagram", href: "#" },
  { platform: "tiktok", href: "#" },
  { platform: "youtube", href: "#" },
];

// Code-owned defaults. `t.footer.tagline` stays the single source for the
// default brand line; the support address is only ever referenced through
// getGlobalShopData() now (was inline in contact + SupportCallout).
const DEFAULT_TAGLINE = t.footer.tagline;
const DEFAULT_SUPPORT_EMAIL = "support@volrep.com";

const CODE_OWNED: GlobalShopData = {
  shopName: SHOP_NAME,
  tagline: DEFAULT_TAGLINE,
  supportEmail: DEFAULT_SUPPORT_EMAIL,
  logo: LOGO,
  mainMenu: MAIN_MENU,
  drawerMenu: DRAWER_MENU,
  footerMenu: FOOTER_MENU,
  socialLinks: SOCIAL_LINKS,
};

// Volrep Store Settings (backend `store_settings`, GET /api/store-settings)
// is the source of truth for the wordmark, tagline, support email and the
// three social links. The logo, navigation and footer structure stay
// code-owned this phase — they are not read from Settings.
//
// One server-side fetch per request: `cache()` dedupes this call across
// the root layout and any page/component that also needs it (the contact
// page, the legal-page SupportCallout); the fetch itself is revalidated
// every 600s. There is NO client-side fetch and NO database access here —
// `lib/backend/site-settings` goes through the `server-only` backend
// client.
//
// Fallback is field-by-field: a null result (backend unavailable, row
// unset) OR any empty string falls back to the code-owned value above, so
// no page can break because of a Settings problem.
export const getGlobalShopData = cache(async (): Promise<GlobalShopData> => {
  const settings = await getStoreSettings();
  if (!settings) return CODE_OWNED;

  return {
    ...CODE_OWNED,
    shopName: settings.storeName || CODE_OWNED.shopName,
    tagline: settings.tagline || CODE_OWNED.tagline,
    supportEmail: settings.supportEmail || CODE_OWNED.supportEmail,
    socialLinks: CODE_OWNED.socialLinks.map((link) => {
      const override = settings.social[link.platform];
      return override ? { ...link, href: override } : link;
    }),
  };
});
