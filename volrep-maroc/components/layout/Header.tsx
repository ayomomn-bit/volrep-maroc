"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "@/components/layout/Container";
import { MobileNav } from "@/components/layout/MobileNav";
import { useCart } from "@/components/cart/CartProvider";
import type { GlobalShopData, ShopLogo } from "@/lib/site/types";
import { t } from "@/lib/i18n";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// For elements that only ever render against the black desktop header
// (never the white mobile/tablet one) — the logo's desktop instance and
// the desktop nav links.
const FOCUS_RING_ON_DARK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-black";

// Renders whatever getShopLogo() resolved to: a real image (once Shopify
// Files/Metaobjects provide one) or the text wordmark fallback in use today.
// The "™" mark is static typographic notation, not brand data.
function Logo({ logo, className }: { logo: ShopLogo; className: string }) {
  if (logo.type === "image") {
    return (
      <Image
        src={logo.url}
        alt={logo.altText ?? ""}
        width={160}
        height={40}
        className={`h-6 w-auto lg:h-7 ${className}`}
        loading="eager"
      />
    );
  }

  return (
    <span className={className}>
      {logo.text}
      <span aria-hidden="true">™</span>
    </span>
  );
}

function CartIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 5h2l.7 3M6.2 8l1.6 8.2a1.5 1.5 0 0 0 1.47 1.3h7.6a1.5 1.5 0 0 0 1.47-1.2L19.8 8H6.2Z" />
      <circle cx="10" cy="20" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Header({ data }: { data: GlobalShopData }) {
  const [scrolled, setScrolled] = useState(false);
  const { cartCount, openDrawer } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-[#ECECEC] bg-black transition-[background-color,border-color,box-shadow] duration-300 ease-out lg:border-white/10 lg:bg-black ${
        scrolled ? "shadow-[0_2px_10px_rgba(0,0,0,0.05)]" : "shadow-none"
      }`}
    >
      <Container>
        <div className="grid h-[60px] grid-cols-3 items-center lg:h-[72px]">
          {/* Left: hamburger (<1024px) / logo (≥1024px) */}
          <div className="flex items-center justify-self-start">
            <MobileNav data={data} />
            <Link
              href="/"
              aria-label={t.common.homeSuffix(data.shopName)}
              className={`hidden lg:inline-flex ${FOCUS_RING_ON_DARK} rounded-sm`}
            >
              <Logo logo={data.logo} className="font-heading text-xl font-bold tracking-tight text-white" />
            </Link>
          </div>

          {/* Center: logo (<1024px) / nav (≥1024px) */}
          <div className="flex items-center justify-self-center">
            <Link
              href="/"
              aria-label={t.common.homeSuffix(data.shopName)}
              className={`lg:hidden ${FOCUS_RING} rounded-sm`}
            >
              <Logo logo={data.logo} className="font-heading text-lg font-bold tracking-tight text-white" />
            </Link>

            <nav aria-label={t.nav.primary} className="hidden lg:block">
              <ul className="flex items-center gap-9">
                {data.mainMenu.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`group relative inline-flex whitespace-nowrap rounded-sm py-2 text-[15px] font-medium tracking-[0.02em] text-white/70 transition-colors duration-200 ease-out hover:text-white focus-visible:text-white ${FOCUS_RING_ON_DARK}`}
                    >
                      {link.label}
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 -bottom-0.5 h-px origin-center scale-x-0 bg-white transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Right: cart */}
          <div className="flex items-center justify-self-end">
            <button
              type="button"
              onClick={openDrawer}
              aria-label={cartCount > 0 ? t.nav.cartWithCount(cartCount) : t.nav.cart}
              className={`relative flex h-11 w-11 items-center justify-center rounded-sm text-white transition-colors duration-200 ease-out hover:text-volt lg:text-white ${FOCUS_RING} lg:focus-visible:ring-offset-black`}
            >
              <CartIcon className="h-[22px] w-[22px] lg:h-6 lg:w-6" />
              {cartCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-white"
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
}
