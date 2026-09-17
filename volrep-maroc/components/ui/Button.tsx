import Link from "next/link";
import type { ComponentProps } from "react";

// "primary" and "secondary" are tuned for light (paper) surfaces.
// "invert" is the same strong-CTA treatment for use on ink (black) surfaces
// — e.g. the Header — where a black-on-black button would disappear.
// "blue" is the VOLREP Volt Blue primary action, matching the product
// page's primary CTA colour — solid and flat (no gradient / glow / pulse),
// reserved for the single highest-intent CTA on a surface. Works on both
// light and dark grounds.
// "light" is the inverse: a solid white button with dark text for use ON a
// Volt Blue surface (the homepage's blue storytelling section), where the
// "blue" and "primary" variants would sink into the background.
type ButtonVariant = "primary" | "secondary" | "invert" | "blue" | "light";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:opacity-90 focus-visible:ring-volt focus-visible:ring-offset-background",
  secondary: "border border-ink/20 text-ink hover:border-ink hover:bg-ink/[0.04] focus-visible:ring-volt focus-visible:ring-offset-background",
  invert: "bg-paper text-ink hover:bg-volt hover:text-paper focus-visible:ring-volt focus-visible:ring-offset-ink",
  blue: "bg-volt text-white hover:bg-volt-deep focus-visible:ring-volt focus-visible:ring-offset-background",
  light: "bg-white text-ink hover:bg-white/90 focus-visible:ring-white focus-visible:ring-offset-volt",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-base",
};

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tracking-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClassName(variant, size, className)} {...props} />;
}
