"use client";

import { api } from "@/lib/api";
import { useMutation } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { can } from "@/lib/rbac";
import type { ProductDetail, ProductStatus, Role } from "@/lib/types";
import { t } from "@/lib/i18n";
import { Card, CardHeader, Field, Icon, SaveBar, Select, TextInput } from "@/components/ui";
import { useEditableForm } from "./useEditableForm";
import { useRegisterDirty } from "./DirtyContext";

const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function InfoSection({ product, role, onSaved }: { product: ProductDetail; role: Role | undefined; onSaved: () => void }) {
  const toast = useToast();
  const canSetStatus = can(role, "product.setStatus");

  const { value: form, setValue: setForm, dirty, commit } = useEditableForm(
    {
      title: product.title,
      subtitle: product.content.subtitle,
      handle: product.handle,
      productType: product.productType,
      tags: product.tags.join(", "),
      status: product.status,
    },
    product.updatedAt,
  );
  useRegisterDirty("info", dirty);

  const handleChanged = form.handle !== product.handle;
  const handleInvalid = handleChanged && !HANDLE_RE.test(form.handle);

  const save = useMutation(() => {
    if (handleInvalid) throw new Error(t.products.info.handleInvalid);
    const tags = form.tags.split(",").map((s) => s.trim()).filter(Boolean);
    const payload: Record<string, unknown> = {};
    if (form.title.trim() !== product.title) payload.title = form.title.trim();
    if (form.subtitle !== product.content.subtitle) payload.subtitle = form.subtitle;
    if (form.handle !== product.handle) payload.handle = form.handle;
    if (form.productType.trim() !== product.productType) payload.productType = form.productType.trim();
    if (JSON.stringify(tags) !== JSON.stringify(product.tags)) payload.tags = tags;
    if (canSetStatus && form.status !== product.status) payload.status = form.status;
    if (Object.keys(payload).length === 0) return Promise.resolve(null);
    return api.patch(`/api/admin/products/${product.id}`, payload);
  });

  return (
    <Card>
      <CardHeader title={t.products.info.title} />
      <form
        className="space-y-4 px-4 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await save.run();
          if (res !== undefined) {
            commit();
            toast.success(t.products.toast.saved);
            onSaved();
          } else if (save.error) {
            toast.error(t.products.toast.saveError, save.error);
          }
        }}
      >
        <Field label={t.products.info.titleField}>
          <TextInput value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label={t.products.info.subtitle} hint={t.products.info.subtitleHint}>
          <TextInput value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
        </Field>
        <Field
          label={t.products.info.handle}
          hint={t.products.info.handleHint}
          error={handleInvalid ? t.products.info.handleInvalid : undefined}
        >
          <TextInput value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} />
        </Field>
        {handleChanged && !handleInvalid && (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <Icon.alert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t.products.info.handleChangeWarning}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.products.info.productType}>
            <TextInput value={form.productType} onChange={(e) => setForm((f) => ({ ...f, productType: e.target.value }))} />
          </Field>
          <Field label={t.products.info.status} hint={t.products.info.statusHint(!canSetStatus)}>
            <Select
              value={form.status}
              disabled={!canSetStatus}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProductStatus }))}
            >
              <option value="draft">{t.products.statusOptions.draft}</option>
              <option value="active">{t.products.statusOptions.active}</option>
              <option value="archived">{t.products.statusOptions.archived}</option>
            </Select>
          </Field>
        </div>
        <Field label={t.products.info.tags} hint={t.common.commaSeparated}>
          <TextInput value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
        </Field>
        <SaveBar type="submit" dirty={dirty} saving={save.pending} error={save.error} label={t.products.info.save} disabled={handleInvalid} />
      </form>
    </Card>
  );
}
