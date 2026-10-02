"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useMutation } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import type { ProductDetail } from "@/lib/types";
import { switchToSimpleBlockedReason } from "@/lib/mode-switch";
import { t } from "@/lib/i18n";
import { Badge, Card, CardHeader, ConfirmDialog, InlineError } from "@/components/ui";

// "Produit simple" / "Produit avec variantes" toggle — PATCH
// /api/admin/products/:id/mode. Switching never DELETES a variant; see the
// backend's switchProductMode (services/admin/products.ts) for the exact
// rules this dialog mirrors:
//   - simple → variants is always allowed (the Default Variant becomes an
//     ordinary, editable one).
//   - variants → simple is allowed with 0 variants (a fresh Default
//     Variant is created on the fly, price unset / stock 0) or with
//     exactly 1 (its values are copied onto the product) — this component
//     only disables the switch, with an explanatory hint, for 2+ variants,
//     rather than letting the admin hit that 409 blind.
export function ModeSwitch({ product, onChanged }: { product: ProductDetail; onChanged: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState<"simple" | "variants" | null>(null);

  const switchMode = useMutation((mode: "simple" | "variants") =>
    api.patch(`/api/admin/products/${product.id}/mode`, { mode }),
  );

  const blocked = switchToSimpleBlockedReason(product.variants.length);
  const blockedReason = blocked === "multiple" ? t.products.mode.switchToSimpleBlockedMultiple : null;

  async function confirm() {
    if (!confirming) return;
    const ok = await switchMode.run(confirming);
    if (ok !== undefined) {
      setConfirming(null);
      toast.success(t.products.toast.saved);
      onChanged();
    }
    // On failure (e.g. 409 VARIANT_IN_CART raced in after this dialog was
    // opened) the dialog stays open with switchMode.error shown inline —
    // same "leave it open, show the error" pattern as VariantsManager's
    // VariantFormModal.
  }

  return (
    <Card>
      <CardHeader
        title={t.products.mode.label}
        description={product.hasVariants ? t.products.mode.variantsHint : t.products.mode.simpleHint}
        action={<Badge tone="neutral">{product.hasVariants ? t.products.mode.variants : t.products.mode.simple}</Badge>}
      />
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {product.hasVariants ? (
          <button
            type="button"
            className="text-sm font-medium text-volt hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
            disabled={Boolean(blockedReason)}
            title={blockedReason ?? undefined}
            onClick={() => setConfirming("simple")}
          >
            {t.products.mode.switchToSimple}
          </button>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-volt hover:underline"
            onClick={() => setConfirming("variants")}
          >
            {t.products.mode.switchToVariants}
          </button>
        )}
        {blockedReason && product.hasVariants && <p className="text-xs text-slate-400">{blockedReason}</p>}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming === "simple" ? t.products.mode.switchToSimpleConfirmTitle : t.products.mode.switchToVariantsConfirmTitle}
        body={
          <>
            <p>
              {confirming === "variants"
                ? t.products.mode.switchToVariantsConfirmBody
                : product.variants.length === 0
                  ? t.products.mode.switchToSimpleConfirmBodyEmpty
                  : t.products.mode.switchToSimpleConfirmBody}
            </p>
            <InlineError message={switchMode.error} />
          </>
        }
        confirmLabel={confirming === "simple" ? t.products.mode.switchToSimple : t.products.mode.switchToVariants}
        loading={switchMode.pending}
        onCancel={() => setConfirming(null)}
        onConfirm={confirm}
      />
    </Card>
  );
}
