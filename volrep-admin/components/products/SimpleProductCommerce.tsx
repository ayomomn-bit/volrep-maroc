"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useMutation } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import type { ProductDetail } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { discountPercent, validateSimpleCommerce } from "@/lib/pricing";
import { t } from "@/lib/i18n";
import { Badge, Button, Card, CardHeader, Field, InlineError, Modal, SaveBar, TextInput } from "@/components/ui";
import { useEditableForm } from "./editor/useEditableForm";
import { useRegisterDirty } from "./editor/DirtyContext";

// The simple-product counterpart to VariantsManager: price / compare-at /
// availability live directly on the product (PATCH /api/admin/products/:id)
// and stock moves through the new product-level inventory endpoint (POST
// /api/admin/products/:id/inventory), which just resolves the product's
// Default Variant and reuses adjustInventory() — same audit trail as a
// variant's own stock. Rendered only when `product.hasVariants` is false
// (ProductStudio switches between this and VariantsManager).
export function SimpleProductCommerce({ product, onChanged }: { product: ProductDetail; onChanged: () => void }) {
  const toast = useToast();
  const commerce = product.commerce;
  const [adjusting, setAdjusting] = useState(false);

  const { value: form, setValue: setForm, dirty, commit } = useEditableForm(
    {
      price: commerce?.price.amount ?? "",
      compareAt: commerce?.compareAtPrice?.amount ?? "",
      available: commerce?.availableForSale ?? true,
    },
    product.updatedAt,
  );
  useRegisterDirty("commerce", dirty);

  const save = useMutation(() => {
    const p = form.price.trim();
    const c = form.compareAt.trim();
    const error = validateSimpleCommerce(p, c);
    if (error) throw new Error(t.products.simple[error]);

    const payload: Record<string, unknown> = {};
    if (p !== commerce?.price.amount) payload.priceAmount = p;
    const nextCompare = c || null;
    if (nextCompare !== (commerce?.compareAtPrice?.amount ?? null)) payload.compareAtAmount = nextCompare;
    if (form.available !== (commerce?.availableForSale ?? true)) payload.availableForSale = form.available;
    if (Object.keys(payload).length === 0) return Promise.resolve(null);
    return api.patch(`/api/admin/products/${product.id}`, payload);
  });

  if (!commerce) return null;

  const pct = discountPercent(commerce.price.amount, commerce.compareAtPrice?.amount ?? null);

  return (
    <Card>
      <CardHeader title={t.products.simple.title} description={t.products.simple.subtitle} />
      <form
        className="space-y-4 px-4 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await save.run();
          if (res !== undefined) {
            commit();
            toast.success(t.products.toast.saved);
            onChanged();
          } else if (save.error) {
            toast.error(t.products.toast.saveError, save.error);
          }
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.products.simple.price}>
            <TextInput
              value={form.price}
              inputMode="decimal"
              placeholder="299.00"
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </Field>
          <Field label={t.products.simple.compareAt}>
            <TextInput
              value={form.compareAt}
              inputMode="decimal"
              placeholder="399.00"
              onChange={(e) => setForm((f) => ({ ...f, compareAt: e.target.value }))}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
          />
          {t.products.simple.availableForSale}
        </label>

        {pct !== null && (
          <p className="text-xs text-slate-400">
            {formatMoney(commerce.price)} <Badge tone="danger">{t.products.pricing.discountBadge(pct)}</Badge>
          </p>
        )}

        <SaveBar type="submit" dirty={dirty} saving={save.pending} error={save.error} label={t.products.simple.save} />
      </form>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.products.simple.stockLabel}</p>
          <Badge tone={commerce.stock === 0 ? "danger" : commerce.stock <= 5 ? "warning" : "neutral"}>{commerce.stock}</Badge>
        </div>
        <Button variant="secondary" onClick={() => setAdjusting(true)}>
          {t.products.simple.adjustStock}
        </Button>
      </div>

      {adjusting && (
        <AdjustStockDialog
          productId={product.id}
          currentStock={commerce.stock}
          onClose={() => setAdjusting(false)}
          onDone={() => {
            setAdjusting(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

// POST /api/admin/products/:id/inventory, { mode: "set", quantity, reason }
// — the exact same contract as a variant's own inventory endpoint, just
// resolved to the product's Default Variant server-side.
function AdjustStockDialog({
  productId,
  currentStock,
  onClose,
  onDone,
}: {
  productId: string;
  currentStock: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [quantity, setQuantity] = useState(String(currentStock));
  const [reason, setReason] = useState("");

  const adjust = useMutation(() => {
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 0) throw new Error(t.products.simple.quantityInvalid);
    if (!reason.trim()) throw new Error(t.products.simple.reasonRequired);
    return api.post(`/api/admin/products/${productId}/inventory`, { mode: "set", quantity: q, reason: reason.trim() });
  });

  return (
    <Modal
      open
      onClose={onClose}
      busy={adjust.pending}
      title={t.products.simple.adjustStockTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={adjust.pending}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            loading={adjust.pending}
            onClick={async () => {
              const ok = await adjust.run();
              if (ok !== undefined) {
                toast.success(t.products.simple.adjustSuccess);
                onDone();
              } else if (adjust.error) {
                toast.error(t.products.simple.adjustError, adjust.error);
              }
            }}
          >
            {t.products.simple.adjustConfirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t.products.simple.newQuantity}>
          <TextInput value={quantity} inputMode="numeric" onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label={t.products.simple.reason}>
          <TextInput value={reason} placeholder={t.products.simple.reasonPlaceholder} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <InlineError message={adjust.error} />
      </div>
    </Modal>
  );
}
