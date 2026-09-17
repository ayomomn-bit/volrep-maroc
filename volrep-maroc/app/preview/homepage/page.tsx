import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { HomepageRenderer } from "@/components/home/HomepageRenderer";
import { getStorefrontHomepage } from "@/lib/backend/homepage";

// Draft preview of the Homepage Studio document. Opened from Homepage
// Studio with a short-lived signed token (?token=…) minted by the admin
// backend (volrep-backend/src/lib/homepage/preview-token.ts). With a valid
// token the backend serves the UNPUBLISHED draft; without one it serves the
// published homepage. Uses the SAME <HomepageRenderer> as "/" — this is not
// a second homepage implementation.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// The token is per-request state and the draft must never be cached.
export const dynamic = "force-dynamic";

const BANNER_STYLE: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 9999,
  background: "#111827",
  color: "#fff",
  font: "600 12px/1.4 system-ui, -apple-system, sans-serif",
  letterSpacing: "0.04em",
  textAlign: "center",
  padding: "8px 12px",
};

export default async function HomepagePreview({
  searchParams,
}: PageProps<"/preview/homepage">) {
  const sp = await searchParams;
  const raw = sp.token;
  const token = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  const { page, preview } = await getStorefrontHomepage({ previewToken: token });

  return (
    <>
      <div style={BANNER_STYLE}>
        {preview
          ? "APERÇU — brouillon non publié. Cette page n’est pas visible par les clients."
          : "APERÇU — jeton absent, invalide ou expiré : la version publiée est affichée."}
      </div>
      <HomepageRenderer document={page} />
    </>
  );
}
