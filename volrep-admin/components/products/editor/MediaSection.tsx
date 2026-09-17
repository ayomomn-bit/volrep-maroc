"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { ProductDetail, ProductImage } from "@/lib/types";
import { t } from "@/lib/i18n";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DropZone,
  EmptyState,
  Field,
  Icon,
  InlineError,
  TextInput,
} from "@/components/ui";

type UploadState = "idle" | "uploading" | "success" | "error";

export function MediaSection({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const toast = useToast();
  const [upload, setUpload] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductImage | null>(null);

  const images = product.images;
  const ownedCount = images.filter((i) => i.owned).length;

  async function doUpload(file: File) {
    setError(null);
    setUpload("uploading");
    try {
      const form = new FormData();
      form.append("file", file);
      await api.upload(`/api/admin/products/${product.id}/media`, form);
      setUpload("success");
      toast.success(t.studio.media.state.success);
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.studio.media.state.error;
      setError(msg);
      setUpload("error");
      toast.error(t.studio.media.state.error, msg);
    }
  }

  async function run(fn: () => Promise<unknown>, okToast: string) {
    setError(null);
    setPending(true);
    try {
      await fn();
      toast.success(okToast);
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.common.actionFailed;
      setError(msg);
      toast.error(t.products.toast.saveError, msg);
    } finally {
      setPending(false);
    }
  }

  function move(index: number, delta: number) {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    void run(
      () => api.put(`/api/admin/products/${product.id}/media/order`, { order: next.map((i) => i.id) }),
      t.products.toast.reordered,
    );
  }

  return (
    <Card>
      <CardHeader
        title={t.studio.media.title}
        description={t.studio.media.subtitle}
        action={
          images.length > 0 ? (
            <span className="text-xs text-slate-400">{t.studio.media.countLabel(images.length, ownedCount)}</span>
          ) : undefined
        }
      />

      <div className="space-y-4 px-4 py-4">
        <DropZone onFile={doUpload} uploading={upload === "uploading"} hint={t.studio.media.dropHint} />
        {upload === "success" && !error && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <Icon.check className="h-3.5 w-3.5" />
            {t.studio.media.state.success}
          </p>
        )}
        <InlineError message={error} />

        {images.length === 0 ? (
          <EmptyState title={t.products.media.empty} />
        ) : (
          <>
            <p className="text-xs text-slate-400">{t.studio.media.primaryHint}</p>
            <ul className="space-y-3">
              {images.map((img, i) => (
                <MediaRow
                  key={img.id}
                  productId={product.id}
                  image={img}
                  isPrimary={i === 0}
                  isLast={i === images.length - 1}
                  disabled={pending || upload === "uploading"}
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  onMakePrimary={() =>
                    run(() => api.put(`/api/admin/products/${product.id}/media/${img.id}/primary`), t.products.toast.primarySet)
                  }
                  onDelete={() => setConfirmDelete(img)}
                  onSaved={onSaved}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t.products.media.deleteTitle}
        body={t.products.media.deleteBody}
        danger
        confirmLabel={t.products.media.delete}
        loading={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const img = confirmDelete;
          setConfirmDelete(null);
          if (img) await run(() => api.del(`/api/admin/products/${product.id}/media/${img.id}`), t.products.toast.imageDeleted);
        }}
      />
    </Card>
  );
}

function MediaRow({
  productId,
  image,
  isPrimary,
  isLast,
  disabled,
  onUp,
  onDown,
  onMakePrimary,
  onDelete,
  onSaved,
}: {
  productId: string;
  image: ProductImage;
  isPrimary: boolean;
  isLast: boolean;
  disabled: boolean;
  onUp: () => void;
  onDown: () => void;
  onMakePrimary: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [alt, setAlt] = useState(image.altText ?? "");
  const [savingAlt, setSavingAlt] = useState(false);
  const altDirty = alt !== (image.altText ?? "");

  return (
    <li
      className={`flex flex-col gap-3 rounded-md border p-3 sm:flex-row ${
        isPrimary ? "border-volt bg-volt-soft/50" : "border-slate-200"
      }`}
    >
      <div className="relative h-24 w-24 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.altText ?? ""}
          className="h-24 w-24 rounded object-contain ring-1 ring-slate-200"
        />
        {isPrimary && (
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-volt text-white shadow">
            <Icon.star className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {isPrimary && <Badge tone="accent">{t.studio.media.primaryTag}</Badge>}
          {image.owned ? (
            <Badge tone="success">{t.products.media.ownedNote}</Badge>
          ) : (
            <Badge tone="warning">{t.products.media.externalBadge}</Badge>
          )}
          {image.byteSize != null && (
            <span className="text-xs text-slate-400">{t.products.media.sizeKb(Math.round(image.byteSize / 1024))}</span>
          )}
        </div>
        {!image.owned && <p className="text-xs text-amber-600">{t.products.media.externalNote}</p>}
        <Field label={t.products.media.altText}>
          <div className="flex gap-2">
            <TextInput value={alt} placeholder={t.products.media.altPlaceholder} onChange={(e) => setAlt(e.target.value)} />
            <Button
              variant="secondary"
              disabled={!altDirty}
              loading={savingAlt}
              onClick={async () => {
                setSavingAlt(true);
                try {
                  await api.patch(`/api/admin/products/${productId}/media/${image.id}`, { altText: alt.trim() || null });
                  toast.success(t.products.toast.saved);
                  onSaved();
                } catch (e) {
                  toast.error(t.products.toast.saveError, e instanceof ApiError ? e.message : undefined);
                } finally {
                  setSavingAlt(false);
                }
              }}
            >
              {t.products.media.saveAlt}
            </Button>
          </div>
        </Field>
      </div>
      <div className="flex shrink-0 flex-row flex-wrap gap-1 sm:flex-col">
        <Button size="sm" variant="ghost" disabled={disabled || isPrimary} onClick={onUp}>
          <Icon.arrowUp className="h-3.5 w-3.5" /> {t.products.media.moveUp}
        </Button>
        <Button size="sm" variant="ghost" disabled={disabled || isLast} onClick={onDown}>
          <Icon.arrowDown className="h-3.5 w-3.5" /> {t.products.media.moveDown}
        </Button>
        {!isPrimary && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onMakePrimary}>
            <Icon.star className="h-3.5 w-3.5" /> {t.products.media.makePrimary}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-red-600" disabled={disabled} onClick={onDelete}>
          <Icon.trash className="h-3.5 w-3.5" /> {t.products.media.delete}
        </Button>
      </div>
    </li>
  );
}
