"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useMutation, useResource } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import type { LandingPageBinding, LandingPagesResponse } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { t, liryaStatusLabel, liryaSyncErrorLabel, liryaRoleLabel } from "@/lib/i18n";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Icon,
  InlineError,
  LoadingBlock,
} from "@/components/ui";
import { availableRoles, bannerKind, canAssociateMore, canPreview, editorLinkVisible } from "@/lib/landing-pages";
import { LiryaPagePicker } from "./LiryaPagePicker";

// Pages marketing tab (Lirya V1, READ-ONLY). Self-fetches from
// GET /api/admin/products/:id/landing-pages?refresh=1 — a best-effort
// endpoint that freshens the cache from Lirya but never blocks. Product
// Studio itself never calls Lirya; only this tab does. A product may hold
// several bindings (one page per role). `onSaved` re-fetches the parent
// /studio payload so Vue d'ensemble reflects an association immediately.
export function LandingPagesSection({ productId, onSaved }: { productId: string; onSaved?: () => void }) {
  const fetcher = useCallback(
    () => api.get<LandingPagesResponse>(`/api/admin/products/${productId}/landing-pages`, { refresh: 1 }),
    [productId],
  );
  const { data, error, loading, reload } = useResource(fetcher);
  const [pickerOpen, setPickerOpen] = useState(false);

  // A binding change must refresh BOTH this tab's list and the parent
  // /studio payload (Vue d'ensemble reads landing-page completeness from it).
  const refreshAll = useCallback(() => {
    reload();
    onSaved?.();
  }, [reload, onSaved]);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader title={t.studio.landingPages.title} description={t.studio.landingPages.subtitle} />
        <CardBody>
          <LoadingBlock label={t.studio.landingPages.loading} />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title={t.studio.landingPages.title} description={t.studio.landingPages.subtitle} />
        <CardBody>
          <InlineError message={error} />
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={reload}>
              {t.common.retry}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const bindings = data?.landingPages ?? [];
  const configured = data?.liryaConfigured ?? false;
  const rolesLeft = availableRoles(bindings);
  const canAssociate = canAssociateMore(configured, bindings);
  const associateHint = !configured
    ? t.studio.landingPages.notConfiguredShort
    : rolesLeft.length === 0
      ? t.studio.landingPages.picker.allRolesUsed
      : undefined;

  return (
    <Card>
      <CardHeader
        title={t.studio.landingPages.title}
        description={t.studio.landingPages.subtitle}
        action={
          bindings.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={!canAssociate}
              title={associateHint}
              onClick={() => canAssociate && setPickerOpen(true)}
            >
              <Icon.plus className="h-3.5 w-3.5" /> {t.studio.landingPages.associateMore}
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        {!configured && bindings.length === 0 ? (
          <EmptyState title={t.studio.landingPages.notConfigured} hint={t.studio.landingPages.notConfiguredHint} />
        ) : bindings.length === 0 ? (
          <EmptyState
            title={t.studio.landingPages.empty}
            hint={t.studio.landingPages.emptyHint}
            action={
              <Button
                size="sm"
                variant="primary"
                disabled={!canAssociate}
                title={associateHint}
                onClick={() => canAssociate && setPickerOpen(true)}
              >
                {t.studio.landingPages.associate}
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {t.studio.landingPages.contentInLiryaNote}
            </p>
            {!configured && (
              <p className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Icon.alert className="h-3.5 w-3.5 shrink-0" />
                {t.studio.landingPages.notConfiguredShort}
              </p>
            )}
            <p className="text-xs text-slate-400">{t.studio.landingPages.listHeading(bindings.length)}</p>
            {bindings.map((b) => (
              <BindingCard key={b.id} binding={b} productId={productId} onChanged={refreshAll} />
            ))}
          </div>
        )}
      </CardBody>

      {pickerOpen && (
        <LiryaPagePicker
          open
          productId={productId}
          availableRoles={rolesLeft}
          onClose={() => setPickerOpen(false)}
          onAssociated={refreshAll}
        />
      )}
    </Card>
  );
}

function BindingCard({
  binding,
  productId,
  onChanged,
}: {
  binding: LandingPageBinding;
  productId: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const unassociate = useMutation(() =>
    api.del(`/api/admin/products/${productId}/landing-pages/${binding.id}`),
  );

  async function doUnassociate() {
    const res = await unassociate.run();
    setConfirmOpen(false);
    if (res !== undefined) {
      toast.success(t.studio.landingPages.toast.unassociated);
      onChanged();
    } else if (unassociate.error) {
      toast.error(t.studio.landingPages.toast.unassociateError, unassociate.error);
    }
  }

  const banner = bannerKind(binding);
  const preview = canPreview(binding);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      {/* Header: name + role + Lirya status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{binding.name || t.common.dash}</p>
            <Badge tone="neutral">{liryaRoleLabel(binding.role)}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {t.studio.landingPages.lastChecked(
              binding.lastCheckedAt ? formatRelative(binding.lastCheckedAt) : t.studio.landingPages.neverChecked,
            )}
          </p>
        </div>
        <Badge tone={binding.cachedStatus === "published" ? "success" : "warning"}>
          {liryaStatusLabel(binding.cachedStatus)}
        </Badge>
      </div>

      {/* Sync / status banner */}
      <div className="mt-3 space-y-3">
        {banner === "syncError" && <Warning text={liryaSyncErrorLabel(binding.syncError)} />}
        {banner === "offline" && <Warning text={t.studio.landingPages.offlineWarning} />}
        {banner === "draft" && <Warning text={t.studio.landingPages.draftWarning} />}

        {/* Integrity check */}
        {binding.verified ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
            <Icon.check className="h-3.5 w-3.5 shrink-0" />
            {t.studio.landingPages.linkVerified}
          </p>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <Icon.alert className="h-3.5 w-3.5 shrink-0" />
              {t.studio.landingPages.linkUnverified}
            </p>
            <p className="mt-1 text-xs text-amber-700">{t.studio.landingPages.linkUnverifiedHint}</p>
          </div>
        )}

        {/* Facts */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          <Fact label={t.studio.landingPages.fields.pageId} value={binding.liryaPageId} mono />
          <Fact label={t.studio.landingPages.fields.slug} value={binding.slug || t.common.dash} mono />
          <Fact label={t.studio.landingPages.fields.template} value={binding.template || t.common.dash} />
          <Fact label={t.studio.landingPages.fields.version} value={binding.version || t.common.dash} mono />
        </dl>
      </div>

      {/* Actions — the primary action is editing the content in Lirya. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {editorLinkVisible(binding) && (
          <a
            href={binding.editorUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            title={t.studio.landingPages.editInLiryaHint}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-volt px-2.5 text-[12px] font-medium text-white hover:bg-volt-deep"
          >
            {t.studio.landingPages.editInLirya}
          </a>
        )}

        {preview ? (
          <a
            href={binding.previewUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-volt ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            <Icon.eye className="h-3.5 w-3.5" />
            {t.studio.landingPages.preview}
          </a>
        ) : (
          <span
            className="inline-flex h-7 cursor-not-allowed items-center gap-1.5 rounded-md bg-slate-100 px-2 text-[12px] font-medium text-slate-400"
            title={t.studio.landingPages.previewDisabled}
          >
            <Icon.eye className="h-3.5 w-3.5" />
            {t.studio.landingPages.preview}
          </span>
        )}

        <div className="ml-auto">
          <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)}>
            {t.studio.landingPages.unassociate}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t.studio.landingPages.unassociateTitle}
        body={t.studio.landingPages.unassociateBody}
        danger
        confirmLabel={t.studio.landingPages.unassociate}
        cancelLabel={t.common.cancel}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doUnassociate}
      />
    </div>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <Icon.alert className="h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`text-slate-700 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</dd>
    </div>
  );
}
