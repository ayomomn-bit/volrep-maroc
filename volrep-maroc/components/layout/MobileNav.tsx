"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import type { GlobalShopData, SocialPlatform } from "@/lib/site/types";
import { t } from "@/lib/i18n";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconTruck(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-[18px] w-[18px]" {...props}>
      <path d="M2.5 6.5h10v8h-10z" />
      <path d="M12.5 10h4l3.5 3.5v1h-7.5z" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </svg>
  );
}

function IconReturn(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-[18px] w-[18px]" {...props}>
      <path d="M4 4v5h5" />
      <path d="M4.5 9a8 8 0 1 1 1.7 8.4" />
    </svg>
  );
}

function IconShield(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-[18px] w-[18px]" {...props}>
      <path d="M12 3.5 18.5 6v5.2c0 4.35-2.73 8.02-6.5 9.3-3.77-1.28-6.5-4.95-6.5-9.3V6L12 3.5Z" />
    </svg>
  );
}

const TRUST_BADGES = [
  { icon: IconTruck, label: "Livraison offerte" },
  { icon: IconReturn, label: "Retours sous 30 jours" },
  { icon: IconShield, label: "Garantie 2 ans" },
];

function IconInstagram(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTikTok(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5" {...props}>
      <path d="M14 4v10.2a3.3 3.3 0 1 1-3.3-3.3c.3 0 .6.03.9.1" />
      <path d="M14 4c.4 2.2 2.1 3.9 4.3 4.2" />
    </svg>
  );
}

function IconYouTube(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5" {...props}>
      <rect x="3" y="6" width="18" height="12" rx="4" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const SOCIAL_ICON_BY_PLATFORM: Record<SocialPlatform, { label: string; icon: (props: ComponentProps<"svg">) => React.JSX.Element }> = {
  instagram: { label: "Instagram", icon: IconInstagram },
  tiktok: { label: "TikTok", icon: IconTikTok },
  youtube: { label: "YouTube", icon: IconYouTube },
};

export function MobileNav({ data }: { data: GlobalShopData }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={t.nav.openMenu}
        className={`flex h-11 w-11 items-center justify-center rounded-sm text-white ${FOCUS_RING} focus-visible:ring-offset-black`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6" aria-hidden="true">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-ink/40 transition-opacity duration-300 ease-out ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t.nav.mobileNavigation}
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between px-5">
          <span className="font-heading text-lg font-bold tracking-tight text-ink">
            {data.shopName}
            <span aria-hidden="true">™</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.nav.closeMenu}
            className={`flex h-11 w-11 items-center justify-center rounded-sm text-ink ${FOCUS_RING} focus-visible:ring-offset-white`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav aria-label={t.nav.mobilePrimary} className="flex flex-1 flex-col px-5 pb-8">
          <ul className="flex flex-col">
            {data.drawerMenu.map((link) => (
              <li key={link.label} className="border-b border-[#ECECEC]">
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-sm py-4 text-base font-medium tracking-tight text-ink ${FOCUS_RING} focus-visible:ring-offset-white`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex items-center gap-6">
            {data.socialLinks.map(({ href, platform }) => {
              const { label, icon: Icon } = SOCIAL_ICON_BY_PLATFORM[platform];
              return (
                <Link
                  key={platform}
                  href={href}
                  aria-label={label}
                  className={`text-ink/60 transition-colors duration-200 ease-out hover:text-ink ${FOCUS_RING} focus-visible:ring-offset-white rounded-sm`}
                >
                  <Icon />
                </Link>
              );
            })}
          </div>

          <div className="mt-auto flex flex-col gap-4 border-t border-[#ECECEC] pt-6">
            {TRUST_BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-ink/70">
                <Icon />
                <span className="text-xs font-medium uppercase tracking-[0.12em]">{label}</span>
              </div>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
