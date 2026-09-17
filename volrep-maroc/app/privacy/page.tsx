import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import { SupportCallout } from "@/components/legal/SupportCallout";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment VOLREP collecte, utilise et protège vos informations.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Confidentialité"
      title="Politique de confidentialité"
      description="Comment VOLREP collecte, utilise et protège les informations que vous nous communiquez."
    >
      <LegalSection title="Informations que nous collectons">
        <p>
          Lorsque vous passez une commande ou nous contactez, vous pouvez nous transmettre des informations telles que
          votre nom, votre adresse e-mail, votre adresse de livraison et vos coordonnées de paiement. Les coordonnées de
          paiement sont traitées directement par nos prestataires de commande et de paiement et ne sont pas conservées
          sur les systèmes de VOLREP.
        </p>
      </LegalSection>

      <LegalSection title="Comment nous utilisons vos informations">
        <p>
          Nous utilisons les informations que vous fournissez pour traiter et honorer vos commandes, communiquer avec
          vous au sujet de votre achat, répondre aux demandes d’assistance et améliorer l’expérience d’achat VOLREP.
        </p>
      </LegalSection>

      <LegalSection title="Cookies et statistiques">
        <p>
          Comme la plupart des sites web, VOLREP peut utiliser des cookies et des technologies similaires pour permettre
          au site de fonctionner correctement et pour comprendre l’utilisation générale du site. Vous pouvez gérer les
          cookies dans les paramètres de votre navigateur.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité des données">
        <p>
          Nous prenons des mesures raisonnables pour protéger les informations que vous nous communiquez. Aucune méthode
          de transmission ou de stockage n’étant totalement sûre, nous ne pouvons pas garantir une sécurité absolue.
        </p>
      </LegalSection>

      <LegalSection title="Partage de vos informations">
        <p>
          Nous ne partageons vos informations que dans la mesure nécessaire pour honorer votre commande et faire
          fonctionner notre boutique — par exemple avec les services qui traitent les paiements et livrent votre colis.
          Nous ne vendons pas vos données personnelles.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits et demandes">
        <p>
          Vous pouvez nous contacter à tout moment pour savoir quelles informations nous détenons à votre sujet, demander
          une correction ou demander leur suppression, sous réserve des éléments que nous sommes tenus de conserver pour
          les commandes déjà passées.
        </p>
      </LegalSection>

      <LegalSection title="Modifications de cette politique">
        <p>
          Nous pouvons mettre à jour cette politique de confidentialité de temps à autre. Toute modification sera publiée
          sur cette page.
        </p>
      </LegalSection>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Cette politique est fournie à titre d’information générale et ne constitue pas un avis juridique.
      </p>

      <SupportCallout>{t.legal.supportCallout.privacy}</SupportCallout>
    </LegalPageLayout>
  );
}
