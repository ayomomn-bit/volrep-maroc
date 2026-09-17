"use client";

import { api } from "@/lib/api";
import { useMutation } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import type { ProductDetail } from "@/lib/types";
import { t } from "@/lib/i18n";
import { Card, CardHeader, SaveBar } from "@/components/ui";
import { useEditableForm } from "./useEditableForm";
import { useRegisterDirty } from "./DirtyContext";

// The product's canonical description — the ONE marketing-ish text Volrep
// owns and the storefront product API actually renders. Everything richer
// (sections, layout, visuals, copy) lives in the Lirya landing page.
export function DescriptionSection({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const toast = useToast();
  const { value: form, setValue: setForm, dirty, commit } = useEditableForm(
    { description: product.description },
    product.updatedAt,
  );
  useRegisterDirty("description", dirty);

  const save = useMutation(() => {
    if (form.description === product.description) return Promise.resolve(null);
    return api.patch(`/api/admin/products/${product.id}`, { description: form.description });
  });

  return (
    <Card>
      <CardHeader title={t.studio.description.title} description={t.studio.description.hint} />
      <form
        className="space-y-3 px-4 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await save.run();
          if (res !== undefined) {
            commit();
            toast.success(t.studio.toast.saved);
            onSaved();
          } else if (save.error) {
            toast.error(t.studio.toast.saveError, save.error);
          }
        }}
      >
        <textarea
          className="min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-volt"
          value={form.description}
          onChange={(e) => setForm({ description: e.target.value })}
        />
        <SaveBar type="submit" dirty={dirty} saving={save.pending} error={save.error} label={t.studio.description.save} />
      </form>
    </Card>
  );
}
