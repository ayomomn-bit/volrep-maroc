"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useMutation } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import type { ProductDetail, Variant } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { discountPercent, MONEY_RE } from "@/lib/pricing";
import { t } from "@/lib/i18n";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Icon,
  InlineError,
  Modal,
  Select,
  Table,
  Td,
  TextInput,
  Th,
  Toggle,
} from "@/components/ui";
import { useEditableForm } from "./editor/useEditableForm";
import { useRegisterDirty } from "./editor/DirtyContext";

// The single cohesive "Variantes" area: options (déclinaisons) on top, the
// variants list below, one modal for add/edit. Every write goes through an
// EXISTING endpoint —
//   PUT   /api/admin/products/:id/options
//   POST  /api/admin/products/:id/variants
//   PATCH /api/admin/variants/:variantId          (title/sku/price/compareAt/availableForSale/selectedOptions)
//   DELETE /api/admin/variants/:variantId
// — and is always followed by onChanged(), which refetches the whole
// product. The rendered list is `product.variants` straight from the
// server; there is no second local source of truth.
export function VariantsManager({ product, onChanged }: { product: ProductDetail; onChanged: () => void }) {
  const [form, setForm] = useState<{ mode: "create" } | { mode: "edit"; variant: Variant } | null>(null);
  const [deleting, setDeleting] = useState<Variant | null>(null);

  // A product must keep at least one variant (backend: 409 LAST_VARIANT).
  const canDelete = product.variants.length > 1;

  return (
    <Card>
      <CardHeader
        title={t.products.variants.title}
        description={t.products.variants.subtitle}
        action={
          <Button variant="secondary" onClick={() => setForm({ mode: "create" })}>
            {t.products.variants.add}
          </Button>
        }
      />

      <OptionsPanel product={product} onSaved={onChanged} />

      {product.variants.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">{t.products.variants.empty}</p>
      ) : (
        <Table
          head={
            <tr>
              <Th>{t.products.variants.colVariant}</Th>
              <Th>{t.products.variants.colSku}</Th>
              <Th className="text-right">{t.products.variants.colPrice}</Th>
              <Th className="text-right">{t.products.variants.colCompareAt}</Th>
              <Th className="text-right">{t.products.variants.colStock}</Th>
              <Th>{t.products.variants.colForSale}</Th>
              <Th />
            </tr>
          }
        >
          {product.variants.map((v) => {
            const pct = discountPercent(v.price.amount, v.compareAtPrice?.amount ?? null);
            return (
              <tr key={v.id}>
                <Td className="font-medium text-slate-800">{v.title}</Td>
                <Td className="text-slate-500">{v.sku ?? t.common.dash}</Td>
                <Td className="text-right">{formatMoney(v.price)}</Td>
                <Td className="text-right text-slate-500">
                  {v.compareAtPrice ? (
                    <span className="inline-flex items-center gap-1.5">
                      {formatMoney(v.compareAtPrice)}
                      {pct !== null && <Badge tone="danger">{t.products.pricing.discountBadge(pct)}</Badge>}
                    </span>
                  ) : (
                    t.common.dash
                  )}
                </Td>
                <Td className="text-right">
                  <Badge tone={v.stock === 0 ? "danger" : v.stock <= 5 ? "warning" : "neutral"}>{v.stock}</Badge>
                </Td>
                <Td>
                  <VariantAvailabilityToggle variant={v} onChanged={onChanged} />
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button variant="ghost" onClick={() => setForm({ mode: "edit", variant: v })}>
                    {t.common.edit}
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleting(v)}
                    >
                      {t.products.variants.delete}
                    </Button>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}

      <p className="px-4 py-2 text-xs text-slate-400">{t.products.variants.stockNotice}</p>

      {form && (
        <VariantFormModal
          product={product}
          variant={form.mode === "edit" ? form.variant : null}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            onChanged();
          }}
        />
      )}

      {deleting && (
        <DeleteVariantDialog
          variant={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

// ---- Options (déclinaisons) panel ------------------------------------
// Product-level: `PUT /api/admin/products/:id/options` replaces the set.
// Collapsed to a one-line summary; "Modifier" opens the name/valeurs rows.

function OptionsPanel({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const toRows = () => product.options.map((o) => ({ name: o.name, values: o.values.join(", ") }));
  const { value: rows, setValue: setRows, dirty, commit } = useEditableForm(toRows(), product.updatedAt);

  // Only counts as an unsaved change while the editor is actually open.
  useRegisterDirty("options", editing && dirty);

  const save = useMutation(() =>
    api.put(`/api/admin/products/${product.id}/options`, {
      options: rows
        .filter((r) => r.name.trim())
        .map((r, i) => ({
          name: r.name.trim(),
          values: r.values
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          position: i,
        })),
    }),
  );

  const summary =
    product.options.length > 0
      ? product.options.map((o) => `${o.name} : ${o.values.join(" · ")}`).join("     ")
      : t.products.options.emptyShort;

  return (
    <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t.products.options.title}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{summary}</p>
        </div>
        {!editing && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {product.options.length > 0 ? t.common.edit : t.products.options.add}
          </Button>
        )}
      </div>

      {editing && (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await save.run();
            if (ok !== undefined) {
              commit();
              setEditing(false);
              toast.success(t.products.toast.saved);
              onSaved();
            } else if (save.error) {
              toast.error(t.products.toast.saveError, save.error);
            }
          }}
        >
          <p className="text-xs text-slate-400">{t.products.options.subtitle}</p>

          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <Field label={t.products.options.name}>
                <TextInput
                  value={row.name}
                  placeholder={t.products.options.namePlaceholder}
                  onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
              </Field>
              <Field label={t.products.options.values} hint={t.common.commaSeparated}>
                <TextInput
                  value={row.values}
                  placeholder={t.products.options.valuesPlaceholder}
                  onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))}
                />
              </Field>
              <Button variant="ghost" type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                <Icon.trash className="h-3.5 w-3.5" /> {t.common.remove}
              </Button>
            </div>
          ))}

          <Button
            variant="secondary"
            type="button"
            onClick={() => setRows((r) => [...r, { name: "", values: "" }])}
          >
            {t.products.options.add}
          </Button>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <Button type="submit" variant="primary" loading={save.pending}>
              {t.products.options.save}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={save.pending}
              onClick={() => {
                setRows(toRows());
                setEditing(false);
              }}
            >
              {t.common.cancel}
            </Button>
            <InlineError message={save.error} />
          </div>
        </form>
      )}
    </div>
  );
}

// ---- Inline "En vente" switch --------------------------------------
// Reuses PATCH /api/admin/variants/:id { availableForSale }.

function VariantAvailabilityToggle({ variant, onChanged }: { variant: Variant; onChanged: () => void }) {
  const toast = useToast();
  const patch = useMutation((next: boolean) =>
    api.patch(`/api/admin/variants/${variant.id}`, { availableForSale: next }),
  );

  return (
    <div className="flex items-center gap-2">
      <Toggle
        checked={variant.availableForSale}
        label={t.products.variants.forSaleToggleLabel(variant.title)}
        onChange={async (next) => {
          if (patch.pending) return;
          const ok = await patch.run(next);
          if (ok !== undefined) {
            toast.success(next ? t.products.variants.forSaleOn : t.products.variants.forSaleOff, variant.title);
            onChanged();
          } else if (patch.error) {
            toast.error(t.products.toast.saveError, patch.error);
          }
        }}
      />
      <span className="text-xs text-slate-500">{variant.availableForSale ? t.common.yes : t.common.no}</span>
    </div>
  );
}

// ---- Add / Edit variant modal -------------------------------------
// POST /api/admin/products/:id/variants  or  PATCH /api/admin/variants/:id.
// When the product has options the title + selectedOptions are derived
// from the option-value pickers; otherwise a free title is used.

function VariantFormModal({
  product,
  variant,
  onClose,
  onSaved,
}: {
  product: ProductDetail;
  variant: Variant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = variant !== null;
  const hasOptions = product.options.length > 0;

  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const o of product.options) {
      init[o.name] = variant?.selectedOptions.find((s) => s.name === o.name)?.value ?? "";
    }
    return init;
  });
  const [freeTitle, setFreeTitle] = useState(variant?.title ?? "");
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [price, setPrice] = useState(variant?.price.amount ?? "");
  const [compareAt, setCompareAt] = useState(variant?.compareAtPrice?.amount ?? "");
  const [available, setAvailable] = useState(variant?.availableForSale ?? true);

  const selectedOptions = product.options.map((o) => ({ name: o.name, value: picks[o.name] ?? "" }));
  const computedTitle = hasOptions
    ? product.options
        .map((o) => picks[o.name])
        .filter(Boolean)
        .join(" / ")
    : freeTitle.trim();

  const save = useMutation(async () => {
    const p = price.trim();
    const c = compareAt.trim();

    if (hasOptions && product.options.some((o) => !picks[o.name])) {
      throw new Error(t.products.variants.dialog.optionRequired);
    }
    if (!hasOptions && !freeTitle.trim()) {
      throw new Error(t.products.variants.dialog.titleRequired);
    }
    if (!MONEY_RE.test(p)) throw new Error(t.products.variants.dialog.priceInvalid);
    if (c && !MONEY_RE.test(c)) throw new Error(t.products.variants.dialog.compareAtInvalid);
    if (c && Number(c) <= Number(p)) throw new Error(t.products.variants.dialog.compareAtNotAbovePrice);

    if (hasOptions) {
      const dupe = product.variants.some(
        (v) =>
          v.id !== variant?.id &&
          product.options.every(
            (o) => v.selectedOptions.find((s) => s.name === o.name)?.value === picks[o.name],
          ),
      );
      if (dupe) throw new Error(t.products.variants.dialog.duplicateCombo);
    }

    if (isEdit) {
      const payload: Record<string, unknown> = {};
      if (computedTitle !== variant.title) payload.title = computedTitle;
      if ((sku.trim() || null) !== variant.sku) payload.sku = sku.trim() || null;
      if (p !== variant.price.amount) payload.priceAmount = p;
      const nextCompare = c || null;
      if (nextCompare !== (variant.compareAtPrice?.amount ?? null)) payload.compareAtAmount = nextCompare;
      if (available !== variant.availableForSale) payload.availableForSale = available;
      if (hasOptions && JSON.stringify(selectedOptions) !== JSON.stringify(variant.selectedOptions)) {
        payload.selectedOptions = selectedOptions;
      }
      if (Object.keys(payload).length === 0) return { noop: true };
      return api.patch(`/api/admin/variants/${variant.id}`, payload);
    }

    return api.post(`/api/admin/products/${product.id}/variants`, {
      title: computedTitle,
      sku: sku.trim() || null,
      priceAmount: p,
      compareAtAmount: c || null,
      availableForSale: available,
      ...(hasOptions ? { selectedOptions } : {}),
    });
  });

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.pending}
      title={isEdit ? t.products.variants.dialog.editTitle(variant.title) : t.products.variants.dialog.addTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            loading={save.pending}
            onClick={async () => {
              const ok = await save.run();
              if (ok !== undefined) onSaved();
            }}
          >
            {isEdit ? t.products.variants.dialog.saveEdit : t.products.variants.dialog.saveCreate}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {hasOptions ? (
          product.options.map((o) => (
            <Field key={o.id} label={o.name}>
              <Select
                value={picks[o.name] ?? ""}
                onChange={(e) => setPicks((prev) => ({ ...prev, [o.name]: e.target.value }))}
              >
                <option value="">{t.products.variants.dialog.optionPlaceholder}</option>
                {o.values.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </Select>
            </Field>
          ))
        ) : (
          <Field label={t.products.variants.dialog.titleField}>
            <TextInput value={freeTitle} onChange={(e) => setFreeTitle(e.target.value)} />
          </Field>
        )}

        <Field label={t.products.variants.dialog.sku}>
          <TextInput value={sku} onChange={(e) => setSku(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t.products.variants.dialog.price}>
            <TextInput
              value={price}
              inputMode="decimal"
              placeholder="899.00"
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field label={t.products.variants.dialog.compareAt}>
            <TextInput
              value={compareAt}
              inputMode="decimal"
              placeholder="1099.00"
              onChange={(e) => setCompareAt(e.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          {t.products.variants.dialog.availableForSale}
        </label>

        <InlineError message={save.error} />
      </div>
    </Modal>
  );
}

// ---- Delete variant ----------------------------------------------
// Real DELETE. On 409 VARIANT_IN_CART the dialog switches to an
// explanatory state offering "Désactiver la vente" (PATCH availableForSale:
// false) as the actionable alternative.

function DeleteVariantDialog({
  variant,
  onClose,
  onDone,
}: {
  variant: Variant;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [blocked, setBlocked] = useState(false);

  const remove = useMutation(async () => {
    try {
      return await api.del(`/api/admin/variants/${variant.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VARIANT_IN_CART") {
        setBlocked(true);
        return undefined;
      }
      if (err instanceof ApiError && err.code === "LAST_VARIANT") {
        throw new Error(t.products.variants.deleteLastBlocked);
      }
      throw err;
    }
  });

  const disableSale = useMutation(() =>
    api.patch(`/api/admin/variants/${variant.id}`, { availableForSale: false }),
  );

  const busy = remove.pending || disableSale.pending;

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={blocked ? t.products.variants.deleteInCartTitle : t.products.variants.deleteTitle(variant.title)}
      footer={
        blocked ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t.common.close}
            </Button>
            <Button
              variant="primary"
              loading={disableSale.pending}
              onClick={async () => {
                const ok = await disableSale.run();
                if (ok !== undefined) {
                  toast.success(t.products.variants.forSaleOff, variant.title);
                  onDone();
                } else if (disableSale.error) {
                  toast.error(t.products.toast.saveError, disableSale.error);
                }
              }}
            >
              {t.products.variants.deleteInCartAction}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              loading={remove.pending}
              onClick={async () => {
                const ok = await remove.run();
                if (ok !== undefined) onDone();
              }}
            >
              {t.products.variants.deleteConfirm}
            </Button>
          </>
        )
      }
    >
      {blocked ? (
        <div className="space-y-2 text-sm text-slate-600">
          <p>{t.products.variants.deleteInCartExplain}</p>
          <p>{t.products.variants.deleteInCartAfter}</p>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>{t.products.variants.deleteBody(variant.title)}</p>
          <InlineError message={remove.error} />
        </div>
      )}
    </Modal>
  );
}
