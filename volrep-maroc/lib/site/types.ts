// Shared types for the global brand/navigation data layer (lib/site/global.ts).
// This is site chrome — the wordmark/logo, the header/footer/mobile nav
// menus, and the social links. It is entirely code-owned (Phase 2 audit):
// no commerce backend, no CMS, no Shopify. Kept separate from
// lib/backend/products.ts's types, which model catalog data.

export type NavLink = {
  href: string;
  label: string;
};

// A logo is rendered either as an uploaded image or as the text wordmark.
// This discriminated union lets components render either case without
// caring where the image ultimately comes from.
export type ShopLogo =
  | { type: "image"; url: string; altText: string | null }
  | { type: "text"; text: string };

export type FooterMenuColumn = {
  title: string;
  links: NavLink[];
};

export type SocialPlatform = "instagram" | "tiktok" | "youtube";

export type SocialLink = {
  platform: SocialPlatform;
  href: string;
};

export type GlobalShopData = {
  shopName: string;
  // Short brand line shown under the wordmark in the footer. Owned by
  // Volrep Store Settings (store_settings.tagline); falls back to a
  // code-owned default when Settings is empty or unavailable.
  tagline: string;
  // Address used by the "contact us" links on the contact + legal pages.
  // Owned by Store Settings (store_settings.support_email); code-owned
  // fallback otherwise.
  supportEmail: string;
  logo: ShopLogo;
  mainMenu: NavLink[];
  drawerMenu: NavLink[];
  footerMenu: FooterMenuColumn[];
  socialLinks: SocialLink[];
};
