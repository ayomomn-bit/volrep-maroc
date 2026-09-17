"use client";

import { useCallback, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { t } from "@/lib/i18n";
import { formatRelative } from "@/lib/format";
import { productPagePreviewUrl } from "@/lib/config";
import type { PageSection, ProductDetail, ProductPageResponse, PagePreviewToken } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Icon,
  InlineError,
  LoadingBlock,
  SaveBar,
} from "@/components/ui";
import { useEditableForm } from "../useEditableForm";
import { useRegisterDirty } from "../DirtyContext";
import { SectionList } from "./SectionList";

// The "Page produit" tab. Self-fetches GET /api/admin/products/:id/page,
// edits the DRAFT document in place, and wires Save draft / Publish /
// Preview / Revert. The Lirya "Pages marketing" tab is untouched by any of
// this. Nothing here can reach cart / checkout / COD / order APIs.
export function PageStudioSection({
  product,
  onSaved,
}: {
  product: ProductDetail;
  onSaved: () => void;
}) {
  const fetcher = useCallback(
    () => api.get<ProductPageResponse>(`/api/admin/products/${product.id}/page`),
    [product.id],
  );
  const { data, error, loading, reload } = useResource(fetcher);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader title={t.studio.page.title} description={t.studio.page.subtitle} />
        <CardBody>
          <LoadingBlock label={t.studio.page.loading} />
        </CardBody>
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <CardHeader title={t.studio.page.title} description={t.studio.page.subtitle} />
        <CardBody>
          <InlineError message={error ?? t.common.genericError} />
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={reload}>
              {t.common.retry}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return <PageEditor product={product} page={data} reload={reload} onSaved={onSaved} />;
}

function PageEditor({
  product,
  page,
  reload,
  onSaved,
}: {
  product: ProductDetail;
  page: ProductPageResponse;
  reload: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { value: form, setValue, dirty, commit } = useEditableForm(
    { sections: page.draft.sections },
    page.updatedAt,
  );
  useRegisterDirty("page", dirty);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const setSections = (sections: PageSection[]) => setValue({ sections });

  async function saveDraft(): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(`/api/admin/products/${product.id}/page/draft`, {
        document: { version: 1, settings: {}, sections: form.sections },
      });
      commit();
      toast.success(t.studio.page.toast.draftSaved);
      reload();
      onSaved();
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.studio.page.toast.draftSaveError;
      setSaveError(msg);
      toast.error(t.studio.page.toast.draftSaveError, msg);
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
      await api.post(`/api/admin/products/${product.id}/page/publish`);
      toast.success(t.studio.page.toast.published);
      reload();
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.studio.page.toast.publishError;
      setSaveError(msg);
      toast.error(t.studio.page.toast.publishError, msg);
    } finally {
      setSaving(false);
    }
  }

  async function revert() {
    setConfirmRevert(false);
    setSaving(true);
    setSaveError(null);
    try {
      await api.post(`/api/admin/products/${product.id}/page/revert`);
      toast.success(t.studio.page.toast.reverted);
      reload();
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.studio.page.toast.revertError;
      setSaveError(msg);
      toast.error(t.studio.page.toast.revertError, msg);
    } finally {
      setSaving(false);
    }
  }

  async function openPreview() {
    setPreviewing(true);
    try {
      const res = await api.post<PagePreviewToken>(`/api/admin/products/${product.id}/page/preview-token`);
      window.open(productPagePreviewUrl(res.handle, res.token), "_blank", "noopener");
    } catch (e) {
      toast.error(t.studio.page.toast.previewError, e instanceof ApiError ? e.message : undefined);
    } finally {
      setPreviewing(false);
    }
  }

  const hiddenCount = form.sections.filter((s) => !s.enabled).length;

  return (
    <Card>
      <CardHeader title={t.studio.page.title} description={t.studio.page.subtitle} />
      <CardBody className="space-y-5">
        {/* status row */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          {page.hasPublished ? (
            <>
              <Badge tone="success">{t.studio.page.statusPublished}</Badge>
              <span className="text-xs text-slate-500">
                {page.publishedAt ? t.studio.page.lastPublished(formatRelative(page.publishedAt)) : ""}
              </span>
              <span
                className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium ${
                  page.draftMatchesPublished && !dirty ? "text-slate-400" : "text-amber-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    page.draftMatchesPublished && !dirty ? "bg-green-500" : "bg-amber-500"
                  }`}
                />
                {page.draftMatchesPublished && !dirty ? t.studio.page.draftUpToDate : t.studio.page.draftAhead}
              </span>
            </>
          ) : (
            <>
              <Badge tone="warning">{t.studio.page.statusNeverPublished}</Badge>
              <span className="text-xs text-slate-500">{t.studio.page.neverPublishedHint}</span>
            </>
          )}
        </div>

        {!page.draftValid && (
          <p className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <Icon.alert className="h-3.5 w-3.5 shrink-0" />
            {t.studio.page.invalidDraft}
          </p>
        )}

        {/* action bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          <Button variant="primary" loading={saving} disabled={!dirty} onClick={saveDraft}>
            {t.studio.page.saveDraft}
          </Button>
          <Button
            variant="secondary"
            disabled={saving || dirty}
            title={dirty ? t.studio.page.publishBlockedDirty : undefined}
            onClick={() => setConfirmPublish(true)}
          >
            <Icon.check className="h-3.5 w-3.5" /> {t.studio.page.publish}
          </Button>
          <Button variant="secondary" loading={previewing} onClick={openPreview}>
            <Icon.eye className="h-3.5 w-3.5" /> {t.studio.page.preview}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => setConfirmRevert(true)}>
            <Icon.refresh className="h-3.5 w-3.5" /> {t.studio.page.revert}
          </Button>
          <span className="ml-auto text-xs text-slate-400">
            {t.studio.page.sectionsHeading(form.sections.length)}
            {hiddenCount > 0 ? ` · ${hiddenCount} ${t.studio.page.hiddenTag.toLowerCase()}` : ""}
          </span>
        </div>

        <InlineError message={saveError} />
        {dirty && <p className="text-xs text-amber-600">{t.studio.page.previewDirtyHint}</p>}

        <SectionList
          sections={form.sections}
          onChange={setSections}
          media={{ productId: product.id, images: product.images }}
        />

        <SaveBar dirty={dirty} saving={saving} error={saveError} label={t.studio.page.saveDraft} onSave={saveDraft} />
      </CardBody>

      <ConfirmDialog
        open={confirmPublish}
        title={t.studio.page.publishConfirmTitle}
        body={t.studio.page.publishConfirmBody}
        confirmLabel={t.studio.page.publish}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={publish}
      />
      <ConfirmDialog
        open={confirmRevert}
        title={t.studio.page.revertConfirmTitle}
        body={t.studio.page.revertConfirmBody}
        danger
        confirmLabel={t.studio.page.revert}
        onCancel={() => setConfirmRevert(false)}
        onConfirm={revert}
      />
    </Card>
  );
}
