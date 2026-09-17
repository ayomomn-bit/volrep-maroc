"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/hooks";
import { useEditableForm } from "@/components/products/editor/useEditableForm";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/Toast";
import type { StoreSettings } from "@/lib/types";
import { t } from "@/lib/i18n";
import {
  Card,
  CardBody,
  ErrorBlock,
  Field,
  FieldGroup,
  LoadingBlock,
  PageHeader,
  SaveBar,
  TextInput,
} from "@/components/ui";

type Form = {
  storeName: string;
  tagline: string;
  supportEmail: string;
  socialInstagram: string;
  socialTiktok: string;
  socialYoutube: string;
};

function toForm(s: StoreSettings): Form {
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    supportEmail: s.supportEmail,
    socialInstagram: s.social.instagram,
    socialTiktok: s.social.tiktok,
    socialYoutube: s.social.youtube,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;

export default function SettingsPage() {
  const { state } = useAuth();
  const role = state.status === "authenticated" ? state.admin.role : undefined;
  const canWrite = can(role, "settings.write");

  const fetcher = useCallback(
    () => api.get<{ settings: StoreSettings }>("/api/admin/store-settings").then((r) => r.settings),
    [],
  );
  const { data, error, loading, reload } = useResource(fetcher);

  return (
    <div>
      <PageHeader title={t.settings.title} description={t.settings.subtitle} />

      {!canWrite && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-inset ring-amber-200">
          {t.settings.readOnlyNotice}
        </p>
      )}

      {loading && !data && <LoadingBlock />}
      {error && <ErrorBlock message={t.settings.loadError} onRetry={reload} />}

      {data && <SettingsForm settings={data} canWrite={canWrite} onSaved={reload} />}
    </div>
  );
}

function SettingsForm({
  settings,
  canWrite,
  onSaved,
}: {
  settings: StoreSettings;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { value: form, setValue, dirty, commit } = useEditableForm<Form>(toForm(settings), settings.updatedAt);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function set<K extends keyof Form>(key: K, next: string) {
    setValue((f) => ({ ...f, [key]: next }));
  }

  function clientError(f: Form): string | null {
    if (f.storeName.trim().length === 0) return t.settings.fields.storeName;
    if (f.supportEmail.trim() && !EMAIL_RE.test(f.supportEmail.trim())) return t.settings.invalidEmail;
    for (const url of [f.socialInstagram, f.socialTiktok, f.socialYoutube]) {
      if (url.trim() && !HTTP_URL_RE.test(url.trim())) return t.settings.invalidUrl;
    }
    return null;
  }

  async function save() {
    const invalid = clientError(form);
    if (invalid) {
      setSaveError(invalid);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const { settings: updated } = await api.put<{ settings: StoreSettings }>("/api/admin/store-settings", {
        storeName: form.storeName.trim(),
        tagline: form.tagline.trim(),
        supportEmail: form.supportEmail.trim(),
        socialInstagram: form.socialInstagram.trim(),
        socialTiktok: form.socialTiktok.trim(),
        socialYoutube: form.socialYoutube.trim(),
      });
      commit(toForm(updated));
      onSaved();
      toast.success(t.settings.savedToast, t.settings.savedToastBody);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t.common.actionFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardBody className="space-y-8">
        <FieldGroup title={t.settings.groups.identity} description={t.settings.identityHint}>
          <Field label={t.settings.fields.storeName}>
            <TextInput
              value={form.storeName}
              disabled={!canWrite}
              maxLength={120}
              onChange={(e) => set("storeName", e.target.value)}
            />
          </Field>
          <Field label={t.settings.fields.tagline} hint={t.settings.fields.taglineHint}>
            <TextInput
              value={form.tagline}
              disabled={!canWrite}
              maxLength={200}
              onChange={(e) => set("tagline", e.target.value)}
            />
          </Field>
          <Field label={t.settings.fields.supportEmail} hint={t.settings.fields.supportEmailHint}>
            <TextInput
              type="email"
              value={form.supportEmail}
              disabled={!canWrite}
              placeholder="support@volrep.com"
              onChange={(e) => set("supportEmail", e.target.value)}
            />
          </Field>
        </FieldGroup>

        <FieldGroup title={t.settings.groups.social} description={t.settings.socialHint}>
          <Field label={t.settings.fields.instagram}>
            <TextInput
              value={form.socialInstagram}
              disabled={!canWrite}
              placeholder="https://instagram.com/…"
              onChange={(e) => set("socialInstagram", e.target.value)}
            />
          </Field>
          <Field label={t.settings.fields.tiktok}>
            <TextInput
              value={form.socialTiktok}
              disabled={!canWrite}
              placeholder="https://tiktok.com/@…"
              onChange={(e) => set("socialTiktok", e.target.value)}
            />
          </Field>
          <Field label={t.settings.fields.youtube}>
            <TextInput
              value={form.socialYoutube}
              disabled={!canWrite}
              placeholder="https://youtube.com/@…"
              onChange={(e) => set("socialYoutube", e.target.value)}
            />
          </Field>
        </FieldGroup>

        {canWrite && <SaveBar dirty={dirty} saving={saving} error={saveError} onSave={save} />}
      </CardBody>
    </Card>
  );
}
