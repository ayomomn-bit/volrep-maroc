"use client";

import { useState } from "react";
import type { ProductStudio as ProductStudioData, Role } from "@/lib/types";
import { t } from "@/lib/i18n";
import { ConfirmDialog, FieldGroup, Tabs } from "@/components/ui";
import { VariantsManager } from "@/components/products/VariantsManager";
import { DirtyProvider, useDirtyApi } from "./DirtyContext";
import { InfoSection } from "./InfoSection";
import { DescriptionSection } from "./DescriptionSection";
import { MediaSection } from "./MediaSection";
import { OverviewSection } from "./OverviewSection";
import { LandingPagesSection } from "./LandingPagesSection";
import { PageStudioSection } from "./page-studio/PageStudioSection";

// Product Studio = the product control surface inside Volrep. It owns the
// product itself (identity, variants, price, media), the storefront product
// page content ("Page produit") and its binding to a Lirya marketing page.
export type StudioTab = "overview" | "info" | "media" | "page" | "landing-pages";

const TABS: { key: StudioTab; label: string }[] = [
  { key: "overview", label: t.studio.tabs.overview },
  { key: "info", label: t.studio.tabs.info },
  { key: "media", label: t.studio.tabs.media },
  { key: "page", label: t.studio.tabs.page },
  { key: "landing-pages", label: t.studio.tabs.landingPages },
];

export function ProductStudio(props: { studio: ProductStudioData; role: Role | undefined; onSaved: () => void }) {
  return (
    <DirtyProvider>
      <StudioTabs {...props} />
    </DirtyProvider>
  );
}

function StudioTabs({
  studio,
  role,
  onSaved,
}: {
  studio: ProductStudioData;
  role: Role | undefined;
  onSaved: () => void;
}) {
  const { anyDirty } = useDirtyApi();
  const [tab, setTab] = useState<StudioTab>("overview");
  const [pendingTab, setPendingTab] = useState<StudioTab | null>(null);

  function requestTab(next: StudioTab) {
    if (next === tab) return;
    if (anyDirty()) setPendingTab(next);
    else setTab(next);
  }

  const { product } = studio;

  return (
    <div className="space-y-5">
      <Tabs tabs={TABS} active={tab} onChange={(k) => requestTab(k as StudioTab)} />

      {tab === "overview" && (
        <OverviewSection studio={studio} onNavigate={(next) => requestTab(next)} />
      )}

      {tab === "info" && (
        <div className="space-y-7">
          <FieldGroup title={t.studio.info.groupIdentity} description={t.studio.info.groupIdentityHint}>
            <InfoSection product={product} role={role} onSaved={onSaved} />
          </FieldGroup>
          <FieldGroup title={t.studio.info.groupDescription} description={t.studio.info.groupDescriptionHint}>
            <DescriptionSection product={product} onSaved={onSaved} />
          </FieldGroup>
          <FieldGroup title={t.studio.info.groupVariants} description={t.studio.info.groupVariantsHint}>
            <VariantsManager product={product} onChanged={onSaved} />
          </FieldGroup>
        </div>
      )}

      {tab === "media" && <MediaSection product={product} onSaved={onSaved} />}
      {tab === "page" && <PageStudioSection product={product} onSaved={onSaved} />}
      {tab === "landing-pages" && <LandingPagesSection productId={product.id} onSaved={onSaved} />}

      <ConfirmDialog
        open={pendingTab !== null}
        title={t.studio.unsaved.leaveTitle}
        body={t.studio.unsaved.leaveBody}
        danger
        confirmLabel={t.studio.unsaved.leaveConfirm}
        cancelLabel={t.studio.unsaved.stay}
        onCancel={() => setPendingTab(null)}
        onConfirm={() => {
          if (pendingTab) setTab(pendingTab);
          setPendingTab(null);
        }}
      />
    </div>
  );
}
