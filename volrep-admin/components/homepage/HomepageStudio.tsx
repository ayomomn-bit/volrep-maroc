"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { homepageApi } from "@/lib/homepage-api";
import { useResource } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { t } from "@/lib/i18n";
import { formatRelative } from "@/lib/format";
import { homepagePreviewUrl } from "@/lib/config";
import type { HomepageResponse, HomepageSection } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  Icon,
  InlineError,
  Tabs,
} from "@/components/ui";
import { useEditableForm } from "@/components/products/editor/useEditableForm";
import { hasUnpublishedChanges } from "@/lib/homepage-studio";
import type { HomepageMediaCtx } from "./HomepageSectionEditors";
import { OverviewTab } from "./OverviewTab";
import { SectionsTab } from "./SectionsTab";
import { MediaTab } from "./MediaTab";
import { BestSellersTab } from "./BestSellersTab";

export type HomepageStudioTab = "overview" | "sections" | "media" | "best-sellers";

const TABS: { key: HomepageStudioTab; label: string }[] = [
  { key: "overview", label: t.homepage.tabs.overview },
  { key: "sections", label: t.homepage.tabs.sections },
  { key: "media", label: t.homepage.tabs.media },
  { key: "best-sellers", label: t.homepage.tabs.bestSellers },
];

// Homepage Studio = the editable storefront homepage. Draft / publish /
// revert on the singleton document. Media is the product-INDEPENDENT
// site_media library. Nothing here touches products, Product Studio, cart,
// checkout, orders or reviews. Preview opens the storefront's
// /preview/homepage with a short-lived signed token (mirrors Product
// Studio's "Page produit" preview) — it always shows the last SAVED draft.
export function HomepageStudio({ data, reload }: { data: HomepageResponse; reload: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<HomepageStudioTab>("overview");

  const { value: form, setValue, dirty, commit } = useEditableForm(
    { sections: data.draft.sections },
    data.updatedAt,
  );
  const setSections = (sections: HomepageSection[]) => setValue({ sections });

  // One media fetch, shared by the Media tab, the section media pickers and
  // the overview count.
  const mediaFetcher = useCallback(() => homepageApi.listMedia(), []);
  const media = useResource(mediaFetcher);
  const mediaCtx: HomepageMediaCtx = {
    assets: media.data?.media ?? [],
    onUploaded: media.reload,
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Browser-level guard: warn on tab close / reload while the draft is dirty.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function saveDraft(): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    try {
      await homepageApi.saveDraft(form.sections);
      commit();
      toast.success(t.homepage.toast.draftSaved);
      reload();
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.homepage.toast.draftSaveError;
      setSaveError(msg);
      toast.error(t.homepage.toast.draftSaveError, msg);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setConfirmPublish(false);
    setSaving(true);
    setSaveError(null);
    try {
      await homepageApi.publish();
      toast.success(t.homepage.toast.published);
      reload();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.homepage.toast.publishError;
      setSaveError(msg);
      toast.error(t.homepage.toast.publishError, msg);
    } finally {
      setSaving(false);
    }
  }

  // Preview always shows the last SAVED draft (whatever the backend has in
  // homepage.draft), never the in-memory unsaved form state — the token is
  // minted server-side and the storefront preview route reads the draft
  // straight from the database. See t.homepage.previewDirtyHint below.
  async function openPreview() {
    setPreviewing(true);
    try {
      const res = await homepageApi.previewToken();
      window.open(homepagePreviewUrl(res.token), "_blank", "noopener");
    } catch (e) {
      toast.error(t.homepage.toast.previewError, e instanceof ApiError ? e.message : undefined);
    } finally {
      setPreviewing(false);
    }
  }

  async function revert() {
    setConfirmRevert(false);
    setSaving(true);
    setSaveError(null);
    try {
      await homepageApi.revert();
      toast.success(t.homepage.toast.reverted);
      reload();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.homepage.toast.revertError;
      setSaveError(msg);
      toast.error(t.homepage.toast.revertError, msg);
    } finally {
      setSaving(false);
    }
  }

  const unpublished = hasUnpublishedChanges(data, dirty);
  const hiddenCount = form.sections.filter((s) => !s.enabled).length;

  return (
    <div className="space-y-5">
      {/* ---- status + persistent actions ---- */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            {data.hasPublished ? (
              <>
                <Badge tone="success">{t.homepage.statusPublished}</Badge>
                <span className="text-xs text-slate-500">
                  {data.publishedAt ? t.homepage.lastPublished(formatRelative(data.publishedAt)) : ""}
                </span>
              </>
            ) : (
              <>
                <Badge tone="warning">{t.homepage.statusNeverPublished}</Badge>
                <span className="text-xs text-slate-500">{t.homepage.neverPublishedHint}</span>
              </>
            )}
            <span
              className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium ${
                unpublished ? "text-amber-600" : "text-slate-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${unpublished ? "bg-amber-500" : "bg-green-500"}`} />
              {unpublished
                ? dirty
                  ? t.homepage.unsaved
                  : t.homepage.draftAhead
                : t.homepage.draftUpToDate}
            </span>
          </div>

          {!data.draftValid && (
            <p className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <Icon.alert className="h-3.5 w-3.5 shrink-0" />
              {t.homepage.invalidDraft}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" loading={saving} disabled={!dirty} onClick={saveDraft}>
              {t.homepage.saveDraft}
            </Button>
            <Button
              variant="secondary"
              disabled={saving || dirty || !data.draftValid}
              title={dirty ? t.homepage.publishBlockedDirty : undefined}
              onClick={() => setConfirmPublish(true)}
            >
              <Icon.check className="h-3.5 w-3.5" /> {t.homepage.publish}
            </Button>
            <Button variant="secondary" loading={previewing} onClick={openPreview}>
              <Icon.eye className="h-3.5 w-3.5" /> {t.homepage.preview}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => setConfirmRevert(true)}>
              <Icon.refresh className="h-3.5 w-3.5" /> {t.homepage.revert}
            </Button>
            <span className="ml-auto text-xs text-slate-400">
              {t.homepage.sections.count(form.sections.length)}
              {hiddenCount > 0 ? ` · ${t.homepage.sections.hiddenCount(hiddenCount)}` : ""}
            </span>
          </div>

          {dirty && <p className="text-xs text-amber-600">{t.homepage.previewDirtyHint}</p>}
          <InlineError message={saveError} />
        </CardBody>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as HomepageStudioTab)} />

      {tab === "overview" && (
        <OverviewTab
          res={data}
          sections={form.sections}
          dirty={dirty}
          mediaCount={media.data?.media.length}
          onNavigate={(next) => setTab(next)}
        />
      )}
      {tab === "sections" && <SectionsTab sections={form.sections} onChange={setSections} media={mediaCtx} />}
      {tab === "media" && (
        <MediaTab
          assets={media.data?.media ?? []}
          loading={media.loading}
          error={media.error}
          reload={media.reload}
        />
      )}
      {tab === "best-sellers" && <BestSellersTab sections={form.sections} onChange={setSections} />}

      <ConfirmDialog
        open={confirmPublish}
        title={t.homepage.publishConfirmTitle}
        body={t.homepage.publishConfirmBody}
        confirmLabel={t.homepage.publish}
        loading={saving}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={publish}
      />
      <ConfirmDialog
        open={confirmRevert}
        title={t.homepage.revertConfirmTitle}
        body={t.homepage.revertConfirmBody}
        danger
        confirmLabel={t.homepage.revert}
        loading={saving}
        onCancel={() => setConfirmRevert(false)}
        onConfirm={revert}
      />
    </div>
  );
}
