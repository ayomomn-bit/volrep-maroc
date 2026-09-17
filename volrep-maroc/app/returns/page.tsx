import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import { SupportCallout } from "@/components/legal/SupportCallout";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Politique de retour et de remboursement",
  description: "Comment VOLREP gère les retours, la livraison retour offerte et les délais de remboursement.",
};

export default function ReturnsPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Retours"
      title="Politique de retour et de remboursement"
      description="Notre processus de retour est simple, et la livraison retour est à notre charge."
    >
      <LegalSection title="Délai de retour">
        <p>Vous pouvez demander un retour dans les 7 jours suivant la livraison de votre commande.</p>
      </LegalSection>

      <LegalSection title="Livraison retour">
        <p>La livraison retour est GRATUITE.</p>
      </LegalSection>

      <LegalSection title="Remboursements">
        <p>
          Une fois votre article retourné reçu et le retour approuvé, les remboursements sont traités sous 7 jours.
        </p>
      </LegalSection>

      <LegalSection title="Effectuer un retour">
        <p>
          Pour effectuer un retour, contactez notre équipe d’assistance avec les détails de votre commande et nous vous
          guiderons pour la suite.
        </p>
      </LegalSection>

      <SupportCallout>{t.legal.supportCallout.returns}</SupportCallout>
    </LegalPageLayout>
  );
}
