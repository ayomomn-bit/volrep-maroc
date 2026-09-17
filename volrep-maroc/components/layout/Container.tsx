import type { ReactNode } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

// Thin alias of <PageContainer> — the two used to be genuinely different
// widths (this one capped at max-w-7xl/1280px), which meant homepage
// sections (Header, PromoBar, Hero, BestSellers, FAQ, etc., all Container
// consumers) and product-page sections (all PageContainer consumers) landed
// on different left/right edges depending on which page you were on.
// Delegating here instead of re-declaring a second max-width keeps every
// section in the app — home and product alike — on the exact same content
// grid from one source of truth, with no import changes needed anywhere
// this component is already used.
export function Container({ children, className = "" }: ContainerProps) {
  return <PageContainer className={className}>{children}</PageContainer>;
}
