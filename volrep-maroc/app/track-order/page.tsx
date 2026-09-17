import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { TrackOrderForm } from "@/components/track-order/TrackOrderForm";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t.trackOrder.metaTitle,
  description: t.trackOrder.metaDescription,
};

export default function TrackOrderPage() {
  return (
    <div className="bg-background pt-16 pb-20 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
      <PageContainer>
        <div className="mx-auto max-w-[600px] text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            {t.trackOrder.eyebrow}
          </p>

          <h1 className="mt-5 text-4xl uppercase leading-[0.95] tracking-[-0.02em] text-foreground sm:text-5xl">
            {t.trackOrder.title}
          </h1>

          <p className="mx-auto mt-6 max-w-[480px] text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.trackOrder.intro}
          </p>
        </div>

        <div className="mt-12 sm:mt-14 lg:mt-16">
          <TrackOrderForm />
        </div>
      </PageContainer>
    </div>
  );
}
