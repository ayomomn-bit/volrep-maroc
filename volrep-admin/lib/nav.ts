import type { IconName } from "@/components/Icons";
import type { Role } from "@/lib/types";
import { t } from "@/lib/i18n";

// The single source of truth for the sidebar, the active-section
// highlight, and the topbar's current-page title. Grouped around the
// store-control responsibilities Volrep Admin owns — catalogue, content and
// store settings. Operational flows (COD orders, fulfilment, delivery) live
// in the separate COD system; Orders here is a read-only store-context view.
export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  ownerOnly?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: t.nav.groups.store,
    items: [
      { href: "/", label: t.nav.items.dashboard, icon: "dashboard" },
      { href: "/orders", label: t.nav.items.orders, icon: "orders" },
      { href: "/analytics", label: t.nav.items.analytics, icon: "analytics" },
    ],
  },
  {
    label: t.nav.groups.catalog,
    items: [
      { href: "/products", label: t.nav.items.products, icon: "products" },
      { href: "/homepage", label: t.nav.items.homepage, icon: "home" },
      { href: "/reviews", label: t.nav.items.reviews, icon: "reviews" },
    ],
  },
  {
    label: t.nav.groups.settings,
    items: [
      { href: "/shipping", label: t.nav.items.shipping, icon: "shipping" },
      { href: "/audit-log", label: t.nav.items.audit, icon: "audit" },
      { href: "/settings", label: t.nav.items.settings, icon: "settings" },
      { href: "/integrations", label: t.nav.items.integrations, icon: "integrations" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function visibleGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.ownerOnly || role === "owner"),
  })).filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// The label for the current route — used as the topbar page title.
export function currentNavLabel(pathname: string): string {
  const match = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(pathname, i.href));
  return match?.label ?? t.nav.fallbackTitle;
}
