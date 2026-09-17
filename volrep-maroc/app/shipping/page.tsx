import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import { SupportCallout } from "@/components/legal/SupportCallout";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Politique de livraison",
  description: "Préparation des commandes, livraison au Maroc et paiement à la livraison.",
};

// Morocco-only storefront: the checkout accepts Morocco only
// (components/checkout/CheckoutForm.tsx) and orders are paid cash on
// delivery. No confirmed shipping rates or delivery timelines exist in the
// project (shipping_settings is admin-managed and unseeded), so this page
// uses neutral wording rather than quoting figures.
export default function ShippingPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Livraison"
      title="Politique de livraison"
      description="Tout ce qu’il faut savoir sur l’acheminement de votre commande VOLREP au Maroc."
    >
      <LegalSection title="Où nous livrons">
        <p>
          VOLREP livre partout au Maroc. Nous ne proposons pas de livraison en dehors du Maroc pour le moment.
        </p>
      </LegalSection>

      <LegalSection title="Préparation de la commande">
        <p>
          Après votre commande, notre équipe vous contacte pour la confirmer. Votre colis est ensuite préparé et remis
          à notre partenaire de livraison dans les meilleurs délais.
        </p>
      </LegalSection>

      <LegalSection title="Délai de livraison">
        <p>
          Le délai de livraison dépend de votre ville et de votre adresse au Maroc. Le transporteur vous contacte pour
          convenir de la remise de votre colis.
        </p>
      </LegalSection>

      <LegalSection title="Paiement à la livraison">
        <p>
          Les commandes sont réglées en espèces au moment de la livraison. Aucun paiement n’est demandé en ligne et
          aucune donnée bancaire n’est collectée.
        </p>
      </LegalSection>

      <LegalSection title="Estimations de livraison">
        <p>
          Les délais de livraison sont donnés à titre indicatif et ne constituent pas une garantie. La livraison peut
          être affectée par des retards des transporteurs, les jours fériés et d’autres circonstances indépendantes de
          la volonté de VOLREP.
        </p>
      </LegalSection>

      <SupportCallout>{t.legal.supportCallout.shipping}</SupportCallout>
    </LegalPageLayout>
  );
}
