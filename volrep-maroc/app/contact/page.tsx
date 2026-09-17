import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LegalList } from "@/components/legal/LegalList";
import { ButtonLink } from "@/components/ui/Button";
import { getGlobalShopData } from "@/lib/site/global";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t.legal.contact.metaTitle,
  description: t.legal.contact.metaDescription,
};

export default async function ContactPage() {
  const { supportEmail } = await getGlobalShopData();

  return (
    <LegalPageLayout
      eyebrow={t.legal.contact.eyebrow}
      title={t.legal.contact.title}
      description={t.legal.contact.description}
    >
      <div className="rounded-[18px] border border-black/[0.06] bg-white px-6 py-8 sm:px-8 sm:py-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t.legal.contact.emailLabel}</p>
        <a
          href={`mailto:${supportEmail}`}
          className="mt-2 block text-2xl font-bold tracking-tight text-foreground transition-colors duration-300 ease-out hover:text-volt sm:text-3xl"
        >
          {supportEmail}
        </a>
        <p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          {t.legal.contact.emailBody}
        </p>

        <ButtonLink href={`mailto:${supportEmail}`} variant="primary" size="lg" className="mt-6">
          {t.legal.contact.emailCta}
        </ButtonLink>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t.legal.contact.topicsHeading}</h2>
        <div className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          <LegalList items={[...t.legal.contact.topics]} />
        </div>
      </div>
    </LegalPageLayout>
  );
}
