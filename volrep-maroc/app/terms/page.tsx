import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import { SupportCallout } from "@/components/legal/SupportCallout";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Conditions générales",
  description: "Les conditions applicables lorsque vous utilisez le site VOLREP et passez une commande.",
};

const LINK_CLASSNAME = "font-semibold text-foreground underline decoration-volt decoration-2 underline-offset-4 transition-colors duration-300 ease-out hover:text-volt";

export default function TermsPage() {
  return (
    <LegalPageLayout
      eyebrow="Conditions"
      title="Conditions générales"
      description="Les conditions applicables lorsque vous utilisez le site VOLREP et passez une commande chez nous."
    >
      <LegalSection title="Utilisation du site">
        <p>
          En utilisant ce site, vous acceptez de l’utiliser uniquement à des fins licites et d’une manière qui ne
          restreint ni n’entrave l’utilisation du site par autrui.
        </p>
      </LegalSection>

      <LegalSection title="Utilisation acceptable">
        <p>
          Lorsque vous utilisez ce site, vous vous engagez à ne pas en faire un usage abusif — notamment en tentant
          d’accéder sans autorisation à une partie du site, en perturbant son fonctionnement normal ou en l’utilisant
          pour transmettre tout contenu illicite, nuisible ou frauduleux.
        </p>
      </LegalSection>

      <LegalSection title="Informations sur les produits">
        <p>
          Nous nous efforçons de décrire nos produits avec la plus grande précision possible. Les couleurs, dimensions
          et autres détails peuvent légèrement varier par rapport à ce qui s’affiche sur votre écran.
        </p>
      </LegalSection>

      <LegalSection title="Tarifs">
        <p>
          Tous les prix sont indiqués sur le site et sont susceptibles d’être modifiés sans préavis. Nous nous réservons
          le droit de corriger toute erreur de prix.
        </p>
      </LegalSection>

      <LegalSection title="Commandes et paiements">
        <p>
          Passer une commande constitue une offre d’achat d’un produit, que nous pouvons accepter, refuser ou annuler.
          Les paiements sont traités de manière sécurisée par notre prestataire de commande.
        </p>
      </LegalSection>

      <LegalSection title="Livraison">
        <p>
          Les estimations de préparation et de livraison sont détaillées dans notre{" "}
          <Link href="/shipping" className={LINK_CLASSNAME}>
            politique de livraison
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Retours et remboursements">
        <p>
          Les modalités de retour et de remboursement sont détaillées dans notre{" "}
          <Link href="/returns" className={LINK_CLASSNAME}>
            politique de retour et de remboursement
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          L’ensemble du contenu de ce site, y compris le nom VOLREP, le logo, les designs des produits, les images et
          les textes, appartient à VOLREP et ne peut être utilisé sans autorisation.
        </p>
      </LegalSection>

      <LegalSection title="Limitation de responsabilité">
        <p>
          Dans toute la mesure permise par la loi, VOLREP ne saurait être tenu responsable des dommages indirects,
          accessoires ou consécutifs découlant de votre utilisation de ce site ou de nos produits.
        </p>
      </LegalSection>

      <LegalSection title="Modifications de ces conditions">
        <p>
          Nous pouvons mettre à jour ces conditions générales à tout moment. La poursuite de l’utilisation du site après
          la publication des modifications vaut acceptation des conditions mises à jour.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>
          Ces conditions générales sont régies par le droit applicable à l’exploitation de ce site par VOLREP. Si une
          disposition de ces conditions est jugée inapplicable, les dispositions restantes continueront de s’appliquer
          pleinement.
        </p>
      </LegalSection>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Ces conditions sont fournies à titre d’information générale et ne constituent pas un avis juridique.
      </p>

      <SupportCallout>{t.legal.supportCallout.terms}</SupportCallout>
    </LegalPageLayout>
  );
}
