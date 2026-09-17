import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

// The site's one canonical content container — 1440px, the same grid every
// section in the app aligns to, home and product pages alike. <Container>
// (components/layout/Container.tsx) is a thin alias of this component, kept
// around only so its many existing call sites don't need import churn; it
// used to be a genuinely narrower 1280px width, which was the single
// biggest source of misaligned left/right edges between homepage and
// product-page sections. Don't fork a per-section max-w-[...] again — every
// section, including Header/Footer/PromoBar, should keep rendering through
// one of these two names.
export function PageContainer({ children, className = "" }: PageContainerProps) {
  return <div className={`mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-16 ${className}`}>{children}</div>;
}
