"use client";

import Link from "next/link";
import { useState } from "react";
import type { ComponentProps } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import type { GlobalShopData, NavLink, SocialPlatform } from "@/lib/site/types";
import { t } from "@/lib/i18n";

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
    <svg {...ICON_PROPS} className="h-[18px] w-[18px]" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTikTok(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-[18px] w-[18px]" {...props}>
      <path d="M14 4v10.2a3.3 3.3 0 1 1-3.3-3.3c.3 0 .6.03.9.1" />
      <path d="M14 4c.4 2.2 2.1 3.9 4.3 4.2" />
    </svg>
  );
}

function IconYouTube(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-[18px] w-[18px]" {...props}>
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

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out md:hidden ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function FooterLink({ href, label }: NavLink) {
  return (
    <Link
      href={href}
      className="group relative inline-flex text-[15px] font-medium text-muted-foreground transition-colors duration-300 ease-out hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
    >
      {label}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
      />
    </Link>
  );
}

// Collapsible on mobile (closed by default, tap to expand); on md: and up it
// renders as the original always-open column — same DOM, the open/close
// affordance is purely a CSS override (md:grid-rows-[1fr], chevron hidden,
// button inert) so desktop never depends on the React state at all.
function FooterColumn({ title, links }: { title: string; links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-black/[0.06] md:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-5 text-left md:pointer-events-none md:py-0"
      >
        <span className="text-[15px] font-semibold uppercase tracking-[0.06em] text-foreground md:text-base">
          {title}
        </span>
        <IconChevron open={open} />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out md:grid-rows-[1fr] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="flex flex-col gap-4 pb-5 md:pb-0 md:pt-6">
            {links.map((link) => (
              <li key={link.label}>
                <FooterLink {...link} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function Footer({ data }: { data: GlobalShopData }) {
  return (
    <footer className="border-t border-black/[0.06] bg-[#F8F7F3] md:border-t-0">
      {/* Same <PageContainer> (1440px) every product-page section uses —
          footer content now lines up with the same left/right edges as
          Hero/LifestyleBenefits above it instead of its own bespoke
          max-w-[1400px] width. Vertical (pt/pb) padding stays footer-owned,
          passed through className rather than baked into PageContainer. */}
      <PageContainer className="pt-10 pb-10 md:pt-8 md:pb-12 lg:pt-10 lg:pb-16">
        <div className="mx-auto max-w-[340px] md:max-w-none">
          <div className="flex flex-col gap-9 md:grid md:grid-cols-4 md:gap-x-8 md:gap-y-12 md:text-left lg:gap-x-16">
            <div className="text-center md:col-span-1 md:text-left">
              <span className="text-2xl font-bold tracking-tight text-foreground md:text-xl">
                {data.shopName}
                <span aria-hidden="true">™</span>
              </span>
              <p className="mt-2 text-xs text-muted-foreground md:mt-3 md:text-sm">{data.tagline}</p>
            </div>

            {data.footerMenu.map((column) => (
              <FooterColumn key={column.title} title={column.title} links={column.links} />
            ))}
          </div>

          <div className="mt-9 border-t border-black/[0.06] md:mt-20" />

          <div className="my-9 rounded-2xl bg-muted px-6 py-7 md:my-0 md:rounded-none md:bg-transparent md:px-0 md:py-12">
            <div className="flex flex-col items-center justify-center gap-5 md:flex-row md:gap-16">
              {TRUST_BADGES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-muted-foreground">
                  <Icon className="h-5 w-5 md:h-[18px] md:w-[18px]" />
                  <span className="text-sm font-semibold uppercase tracking-[0.1em] md:text-xs md:font-medium md:tracking-[0.12em]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 border-t border-black/[0.06] pt-8 md:flex-row md:justify-between md:gap-4">
            <p className="text-[11px] text-muted-foreground md:text-xs">
              {t.footer.rightsReserved(new Date().getFullYear(), data.shopName)}
            </p>

            <div className="flex items-center gap-6">
              {data.socialLinks.map(({ href, platform }) => {
                const { label, icon: Icon } = SOCIAL_ICON_BY_PLATFORM[platform];
                return (
                  <Link
                    key={platform}
                    href={href}
                    aria-label={label}
                    className="text-muted-foreground opacity-100 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-foreground hover:opacity-80 active:opacity-50 md:hover:opacity-100 md:active:opacity-100"
                  >
                    <Icon className="h-5 w-5 md:h-[18px] md:w-[18px]" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </PageContainer>
    </footer>
  );
}
