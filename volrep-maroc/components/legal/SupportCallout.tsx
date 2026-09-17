import type { ReactNode } from "react";
import { getGlobalShopData } from "@/lib/site/global";

type SupportCalloutProps = {
  children: ReactNode;
};

// Reused at the bottom of every legal page as the "still have questions"
// handoff to support — same rounded/bg-muted card language as the footer's
// trust-badges panel. Async server component: the support address comes
// from Store Settings via the shared, request-cached getGlobalShopData().
export async function SupportCallout({ children }: SupportCalloutProps) {
  const { supportEmail } = await getGlobalShopData();

  return (
    <div className="rounded-2xl bg-muted px-6 py-7 sm:px-8 sm:py-8">
      <p className="text-[15px] leading-relaxed text-foreground sm:text-base">
        {children}{" "}
        <a
          href={`mailto:${supportEmail}`}
          className="font-semibold text-foreground underline decoration-volt decoration-2 underline-offset-4 transition-colors duration-300 ease-out hover:text-volt"
        >
          {supportEmail}
        </a>
      </p>
    </div>
  );
}
