import type { ReactNode } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

type LegalPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

// Shared chrome for the legal/support pages (Privacy, Terms, Shipping,
// Returns, Contact) — same eyebrow/title/intro header and prose-width
// content column every one of them uses, so they read as one system without
// touching the marketing sections' own layouts.
export function LegalPageLayout({ eyebrow, title, description, children }: LegalPageLayoutProps) {
  return (
    <div className="bg-background pt-16 pb-20 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
      <PageContainer>
        <div className="mx-auto max-w-[720px]">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            VOLREP<span aria-hidden="true">™</span> / {eyebrow}
          </p>

          <h1 className="mt-5 text-4xl uppercase leading-[0.95] tracking-[-0.02em] text-foreground sm:text-5xl">
            {title}
          </h1>

          <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>

          <div className="mt-12 space-y-10 border-t border-black/[0.06] pt-12 sm:mt-14 sm:space-y-12 sm:pt-14 lg:mt-16 lg:pt-16">
            {children}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
