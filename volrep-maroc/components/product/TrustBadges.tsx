import type { ComponentProps } from "react";

// Static — no Shopify data or interactivity involved, so this stays a
// Server Component and is passed into ProductInfo (a Client Component) as
// a prop/slot rather than imported there, preserving that server rendering.
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
    <svg {...ICON_PROPS} className="h-5 w-5" {...props}>
      <path d="M2.5 6.5h10v8h-10z" />
      <path d="M12.5 10h4l3.5 3.5v1h-7.5z" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </svg>
  );
}

function IconReturn(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5" {...props}>
      <path d="M4 4v5h5" />
      <path d="M4.5 9a8 8 0 1 1 1.7 8.4" />
    </svg>
  );
}

function IconShield(props: ComponentProps<"svg">) {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5" {...props}>
      <path d="M12 3.5 18.5 6v5.2c0 4.35-2.73 8.02-6.5 9.3-3.77-1.28-6.5-4.95-6.5-9.3V6L12 3.5Z" />
    </svg>
  );
}

const TRUST_BADGES = [
  { icon: IconTruck, title: "Livraison offerte", subtitle: "Sur toutes les commandes" },
  { icon: IconReturn, title: "Retours sous 30 jours", subtitle: "Retours sans complications" },
  { icon: IconShield, title: "Garantie 2 ans", subtitle: "Qualité garantie" },
];

export function TrustBadges() {
  return (
    <ul className="grid grid-cols-3 gap-4 border-t border-ink/10 pt-9">
      {TRUST_BADGES.map(({ icon: Icon, title, subtitle }) => (
        <li
          key={title}
          className="flex min-h-[132px] flex-col items-start justify-center gap-3.5 rounded-2xl border border-ink/[0.06] bg-white p-6 shadow-[0_6px_20px_-14px_rgba(11,11,11,0.2)] transition-all duration-[250ms] ease-out hover:-translate-y-1 hover:border-ink/[0.12] hover:shadow-[0_16px_36px_-14px_rgba(11,11,11,0.3)]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-ink">
            <Icon className="h-[26px] w-[26px]" />
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight text-ink">{title}</span>
            <span className="mt-1 block text-xs leading-snug text-slate">{subtitle}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
